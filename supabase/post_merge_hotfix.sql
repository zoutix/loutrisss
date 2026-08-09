-- Loutris post-merge hotfix
-- Apply AFTER supabase/schema.sql AND supabase/production_hardening_final.sql.
-- This migration is intentionally small and idempotent.

begin;

-- Re-define ranked creation so stale matches are settled through the same
-- authoritative settlement path instead of being silently marked as draws.
-- The match row is locked before changing it, so a concurrent guess cannot
-- race the expiry path.
create or replace function public.start_ranked_match(p_opponent uuid,p_length smallint default 5)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid:=auth.uid();
  v_match public.match_sessions;
  v_answer text;
  v_expired_id uuid;
begin
  if v_user is null then raise exception using errcode='28000',message='AUTH_REQUIRED'; end if;
  if p_opponent is null or p_opponent=v_user then raise exception using errcode='22023',message='INVALID_OPPONENT'; end if;
  if p_length not between 4 and 6 then raise exception using errcode='22023',message='INVALID_LENGTH'; end if;
  if not exists(select 1 from auth.users where id=p_opponent) then raise exception using errcode='P0002',message='OPPONENT_NOT_FOUND'; end if;

  -- Lock each expired match before expiring and settling it. This prevents a
  -- concurrent submit/forfeit from racing the expiry decision.
  for v_expired_id in
    select m.id
      from public.match_sessions m
     where m.active=true
       and m.ranked=true
       and m.last_action_at<now()-interval '5 minutes'
       and exists(
         select 1
           from public.match_participants p
          where p.match_id=m.id
            and p.active=true
            and p.user_id in(v_user,p_opponent)
       )
     for update
  loop
    update public.match_sessions
       set active=false,status='draw',ended_at=now(),last_action_at=now()
     where id=v_expired_id;

    -- IMPORTANT: use the canonical settlement path so draws update stats and
    -- create match_settlements, rather than leaving an un-settled match.
    perform public.settle_ranked_match(v_expired_id,null,'draw');
  end loop;

  if exists(select 1 from public.match_participants where user_id=v_user and active=true and ranked=true) then
    raise exception using errcode='55000',message='ACTIVE_MATCH_EXISTS';
  end if;
  if exists(select 1 from public.match_participants where user_id=p_opponent and active=true and ranked=true) then
    raise exception using errcode='55000',message='OPPONENT_BUSY';
  end if;

  select word into v_answer
    from public.game_words
   where length=p_length and is_answer
   order by gen_random_uuid()
   limit 1;
  if v_answer is null then raise exception using errcode='P0001',message='WORD_POOL_UNAVAILABLE'; end if;

  insert into public.match_sessions(mode,ranked,length,answer,current_player,active)
  values('ranked',true,p_length,v_answer,v_user,true)
  returning * into v_match;

  insert into public.match_participants(match_id,user_id,player_no,active,ranked)
  values(v_match.id,v_user,1,true,true),(v_match.id,p_opponent,2,true,true);

  return jsonb_build_object(
    'id',v_match.id,
    'mode','ranked',
    'ranked',true,
    'length',v_match.length,
    'status',v_match.status,
    'current_player',v_match.current_player,
    'turn_no',v_match.turn_no,
    'started_at',v_match.started_at
  );
exception when unique_violation then
  return jsonb_build_object('ok',false,'error','ACTIVE_MATCH_EXISTS');
end;
$$;
revoke all on function public.start_ranked_match(uuid,smallint) from public,anon,authenticated;
grant execute on function public.start_ranked_match(uuid,smallint) to authenticated;

-- Settlement must re-check idempotency AFTER taking the deterministic player
-- locks. Otherwise two concurrent callers can both observe no settlement,
-- then both award ELO before the second INSERT hits ON CONFLICT.
create or replace function public.settle_ranked_match(p_match_id uuid,p_winner uuid,p_result text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_a uuid;
  v_b uuid;
  v_loser uuid;
  v_we integer;
  v_le integer;
  v_expected numeric;
  v_delta integer:=0;
  v_action uuid:=gen_random_uuid();
begin
  if p_result not in ('win','draw') then
    return jsonb_build_object('ok',false,'error','INVALID_RESULT');
  end if;

  select user_id into v_a from public.match_participants where match_id=p_match_id and player_no=1;
  select user_id into v_b from public.match_participants where match_id=p_match_id and player_no=2;
  if v_a is null or v_b is null then
    return jsonb_build_object('ok',false,'error','PARTICIPANTS_MISSING');
  end if;
  if p_winner is not null and p_winner not in(v_a,v_b) then
    return jsonb_build_object('ok',false,'error','INVALID_WINNER');
  end if;

  -- Stable order prevents A->B / B->A deadlocks.
  perform 1 from public.profiles
   where id in(least(v_a,v_b),greatest(v_a,v_b))
   order by id
   for update;

  -- IMPORTANT: this check is deliberately AFTER the locks.
  if exists(select 1 from public.match_settlements where match_id=p_match_id) then
    return jsonb_build_object('ok',true,'already_settled',true);
  end if;

  if p_result='draw' then
    update public.profiles
       set draws=draws+1,games_played=games_played+1
     where id in(v_a,v_b);
  else
    v_loser:=case when p_winner=v_a then v_b else v_a end;
    select elo into v_we from public.profiles where id=p_winner;
    select elo into v_le from public.profiles where id=v_loser;
    v_expected:=1/(1+power(10,(v_le-v_we)::numeric/400));
    v_delta:=greatest(1,round(32*(1-v_expected)));

    update public.profiles
       set elo=elo+v_delta,
           peak_elo=greatest(peak_elo,elo+v_delta),
           wins=wins+1,
           games_played=games_played+1
     where id=p_winner;
    update public.profiles
       set elo=greatest(0,elo-v_delta),
           losses=losses+1,
           games_played=games_played+1
     where id=v_loser;

    perform public.award_battle_pass_xp_internal(v_a,'MATCH_PLAYED',v_action);
    perform public.award_battle_pass_xp_internal(v_b,'MATCH_PLAYED',v_action);
    perform public.award_battle_pass_xp_internal(p_winner,'MATCH_WON',gen_random_uuid());
  end if;

  insert into public.match_settlements(match_id,winner_id,result)
  values(p_match_id,p_winner,p_result);
  update public.match_participants set active=false where match_id=p_match_id;

  return jsonb_build_object('ok',true,'elo_delta',v_delta);
end;
$$;
revoke all on function public.settle_ranked_match(uuid,uuid,text) from public,anon,authenticated;

-- Purchase must lock the profile BEFORE checking ownership/balance so two
-- concurrent purchases cannot both spend currency for the same item.
create or replace function public.purchase_cosmetic(p_item_id text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid:=auth.uid();
  v_item public.shop_catalog;
  v_balance integer;
begin
  if v_user is null then
    return jsonb_build_object('ok',false,'error','AUTH_REQUIRED');
  end if;

  perform 1 from public.profiles where id=v_user for update;
  if not found then
    return jsonb_build_object('ok',false,'error','PROFILE_NOT_FOUND');
  end if;

  -- Re-read everything after the account lock.
  select * into v_item
    from public.shop_catalog
   where item_id=p_item_id and enabled=true;
  if not found then
    return jsonb_build_object('ok',false,'error','ITEM_NOT_FOUND');
  end if;

  if exists(select 1 from public.inventory where user_id=v_user and item_id=p_item_id) then
    return jsonb_build_object('ok',true,'already_owned',true);
  end if;

  if v_item.currency='coins' then
    select coins into v_balance from public.profiles where id=v_user;
    if v_balance<v_item.price then
      return jsonb_build_object('ok',false,'error','INSUFFICIENT_FUNDS');
    end if;
    update public.profiles set coins=coins-v_item.price where id=v_user;
  else
    select gems into v_balance from public.profiles where id=v_user;
    if v_balance<v_item.price then
      return jsonb_build_object('ok',false,'error','INSUFFICIENT_FUNDS');
    end if;
    update public.profiles set gems=gems-v_item.price where id=v_user;
  end if;

  insert into public.inventory(user_id,item_id)
  values(v_user,p_item_id);

  return jsonb_build_object(
    'ok',true,
    'item_id',p_item_id,
    'currency',v_item.currency,
    'price',v_item.price
  );
end;
$$;
revoke all on function public.purchase_cosmetic(text) from public,anon,authenticated;
grant execute on function public.purchase_cosmetic(text) to authenticated;

commit;
