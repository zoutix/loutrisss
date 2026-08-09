-- Loutris post-merge hotfix
-- Apply AFTER supabase/schema.sql AND supabase/production_hardening_final.sql.
-- This migration is intentionally small and idempotent.

begin;

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
