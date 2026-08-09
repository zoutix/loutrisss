-- LOUTRIS production hardening migration
-- Apply AFTER supabase/schema.sql.
-- This migration removes client write paths for authoritative data, hardens
-- ranked concurrency, expires abandoned matches, and adds safe server APIs.

begin;

-- ---------------------------------------------------------------------
-- PROFILES: browser may read its own row, but may not mutate authoritative
-- columns directly. Profile/settings changes go through the RPC.
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
drop policy if exists "profiles_update_settings" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_delete_own" on public.profiles;
revoke insert, update, delete on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;

-- Never expose the private state blob through the public lookup view.
create or replace view public.usernames with (security_invoker = false) as
select id, username, display_name, avatar, country, elo, wins, peak_elo, team
from public.profiles
where username is not null;
revoke all on public.usernames from anon, authenticated;
grant select on public.usernames to anon, authenticated;

-- ---------------------------------------------------------------------
-- MATCH SAFETY
-- ---------------------------------------------------------------------
create index if not exists match_sessions_participant_active_idx
on public.match_participants(user_id, match_id);
create index if not exists match_sessions_status_last_action_idx
on public.match_sessions(status, last_action_at);
create index if not exists match_guesses_match_turn_idx
on public.match_guesses(match_id, turn_no);

-- One active ranked match per player. The partial unique index prevents a
-- race between two start calls for the same account.
create unique index if not exists one_active_ranked_match_per_player
on public.match_participants(user_id)
where match_id in (select id from public.match_sessions where status = 'playing' and ranked = true);

-- The previous expression cannot be used by PostgreSQL in a partial index
-- predicate because predicates must be immutable. Drop it and use an
-- explicit active flag maintained by the match lifecycle instead.
drop index if exists one_active_ranked_match_per_player;
alter table public.match_sessions add column if not exists active boolean not null default true;
update public.match_sessions set active = (status = 'playing');
create index if not exists match_sessions_active_idx on public.match_sessions(active, ranked, last_action_at);
create unique index if not exists one_active_ranked_match_per_player
on public.match_participants(user_id)
where match_id in (select id from public.match_sessions where active = true and ranked = true);

-- The partial-index form above is still not immutable-safe on some Postgres
-- versions. Use a participant-level active marker instead.
drop index if exists one_active_ranked_match_per_player;
alter table public.match_participants add column if not exists active boolean not null default true;
update public.match_participants p
set active = exists (
  select 1 from public.match_sessions m
  where m.id = p.match_id and m.active = true and m.ranked = true
);
create unique index if not exists one_active_ranked_match_per_player
on public.match_participants(user_id)
where active = true;

-- ---------------------------------------------------------------------
-- Common server-side settlement helper.
-- All profile rows are locked in UUID order to avoid ELO deadlocks.
-- ---------------------------------------------------------------------
create or replace function public.settle_ranked_match(
  p_match_id uuid,
  p_winner uuid,
  p_result text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_a uuid;
  v_b uuid;
  v_a_elo integer;
  v_b_elo integer;
  v_winner_elo integer;
  v_loser_elo integer;
  v_expected numeric;
  v_delta integer;
  v_loser uuid;
  v_action uuid := gen_random_uuid();
begin
  if p_result not in ('win','draw') then
    return jsonb_build_object('ok', false, 'error', 'INVALID_RESULT');
  end if;

  select user_id into v_a from public.match_participants
   where match_id = p_match_id and player_no = 1;
  select user_id into v_b from public.match_participants
   where match_id = p_match_id and player_no = 2;
  if v_a is null or v_b is null then
    return jsonb_build_object('ok', false, 'error', 'PARTICIPANTS_MISSING');
  end if;
  if p_winner is not null and p_winner not in (v_a, v_b) then
    return jsonb_build_object('ok', false, 'error', 'INVALID_WINNER');
  end if;

  -- Lock both rows in a stable order. This is the important concurrency fix.
  if v_a < v_b then
    perform 1 from public.profiles where id in (v_a, v_b) order by id for update;
  else
    perform 1 from public.profiles where id in (v_b, v_a) order by id for update;
  end if;

  if exists (select 1 from public.match_settlements where match_id = p_match_id) then
    return jsonb_build_object('ok', true, 'already_settled', true);
  end if;

  if p_result = 'draw' then
    update public.profiles
       set draws = draws + 1,
           games_played = games_played + 1
     where id in (v_a, v_b);
  else
    v_loser := case when p_winner = v_a then v_b else v_a end;
    select elo into v_winner_elo from public.profiles where id = p_winner;
    select elo into v_loser_elo from public.profiles where id = v_loser;
    v_expected := 1 / (1 + power(10, (v_loser_elo - v_winner_elo)::numeric / 400));
    v_delta := greatest(1, round(32 * (1 - v_expected)));

    update public.profiles
       set elo = elo + v_delta,
           peak_elo = greatest(peak_elo, elo + v_delta),
           wins = wins + 1,
           games_played = games_played + 1
     where id = p_winner;
    update public.profiles
       set elo = greatest(0, elo - v_delta),
           losses = losses + 1,
           games_played = games_played + 1
     where id = v_loser;

    perform public.award_battle_pass_xp_internal(v_a, 'MATCH_PLAYED', v_action);
    perform public.award_battle_pass_xp_internal(v_b, 'MATCH_PLAYED', v_action);
    perform public.award_battle_pass_xp_internal(p_winner, 'MATCH_WON', gen_random_uuid());
  end if;

  insert into public.match_settlements(match_id, winner_id, result)
  values (p_match_id, p_winner, p_result)
  on conflict (match_id) do nothing;

  update public.match_participants
     set active = false
   where match_id = p_match_id;

  return jsonb_build_object('ok', true, 'elo_delta', coalesce(v_delta, 0));
end;
$$;
revoke all on function public.settle_ranked_match(uuid, uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Ranked match creation: authenticated players only, one active match,
-- no self-play, verified opponent, and server-selected answer.
-- ---------------------------------------------------------------------
create or replace function public.start_ranked_match(p_opponent uuid, p_length smallint default 5)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_match public.match_sessions;
  v_answer text;
begin
  if v_user is null then raise exception using errcode='28000', message='AUTH_REQUIRED'; end if;
  if p_opponent is null or p_opponent = v_user then raise exception using errcode='22023', message='INVALID_OPPONENT'; end if;
  if p_length not between 4 and 6 then raise exception using errcode='22023', message='INVALID_LENGTH'; end if;
  if not exists (select 1 from auth.users where id = p_opponent) then raise exception using errcode='P0002', message='OPPONENT_NOT_FOUND'; end if;

  -- Clean up stale activity for this account before enforcing the limit.
  update public.match_sessions m
     set active = false, status = 'draw', ended_at = now(), last_action_at = now()
   where m.active = true
     and m.ranked = true
     and m.last_action_at < now() - interval '5 minutes'
     and exists (select 1 from public.match_participants p where p.match_id = m.id and p.user_id = v_user);
  update public.match_participants p set active = false
   where p.user_id = v_user and p.active = true
     and not exists (select 1 from public.match_sessions m where m.id = p.match_id and m.active = true);

  if exists (select 1 from public.match_participants where user_id = v_user and active = true) then
    raise exception using errcode='55000', message='ACTIVE_MATCH_EXISTS';
  end if;
  if exists (select 1 from public.match_participants where user_id = p_opponent and active = true) then
    raise exception using errcode='55000', message='OPPONENT_BUSY';
  end if;

  select word into v_answer
  from public.game_words
  where length = p_length and is_answer
  order by gen_random_uuid()
  limit 1;
  if v_answer is null then raise exception using errcode='P0001', message='WORD_POOL_UNAVAILABLE'; end if;

  insert into public.match_sessions(mode, ranked, length, answer, current_player, active)
  values ('ranked', true, p_length, v_answer, v_user, true)
  returning * into v_match;

  insert into public.match_participants(match_id, user_id, player_no, active)
  values (v_match.id, v_user, 1, true), (v_match.id, p_opponent, 2, true);

  return jsonb_build_object('id', v_match.id, 'mode', v_match.mode, 'ranked', true,
    'length', v_match.length, 'status', v_match.status, 'current_player', v_match.current_player,
    'turn_no', v_match.turn_no, 'started_at', v_match.started_at);
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'ACTIVE_MATCH_EXISTS');
end;
$$;
revoke execute on function public.start_ranked_match(uuid, smallint) from public;
grant execute on function public.start_ranked_match(uuid, smallint) to authenticated;

-- ---------------------------------------------------------------------
-- Replace guess submission with ordered locking and centralized settlement.
-- ---------------------------------------------------------------------
create or replace function public.submit_match_guess(p_match_id uuid, p_action_id uuid, p_word text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_match public.match_sessions;
  v_guess text := lower(trim(p_word));
  v_eval jsonb;
  v_opponent uuid;
  v_result text;
  v_winner uuid;
  v_settle jsonb;
begin
  if v_user is null then return jsonb_build_object('ok',false,'error','AUTH_REQUIRED'); end if;
  if p_action_id is null or p_match_id is null then return jsonb_build_object('ok',false,'error','INVALID_ACTION'); end if;
  if v_guess !~ '^[a-z]+$' then return jsonb_build_object('ok',false,'error','INVALID_WORD'); end if;

  select m.* into v_match
  from public.match_sessions m
  where m.id = p_match_id
    and m.active = true
    and exists (select 1 from public.match_participants p where p.match_id=m.id and p.user_id=v_user and p.active=true)
  for update;
  if not found then return jsonb_build_object('ok',false,'error','MATCH_NOT_FOUND'); end if;
  if v_match.status <> 'playing' then return jsonb_build_object('ok',false,'error','MATCH_ENDED'); end if;
  if v_match.last_action_at < now() - interval '5 minutes' then
    return jsonb_build_object('ok',false,'error','MATCH_EXPIRED');
  end if;
  if v_match.current_player <> v_user then return jsonb_build_object('ok',false,'error','NOT_YOUR_TURN'); end if;
  if char_length(v_guess) <> v_match.length then return jsonb_build_object('ok',false,'error','INVALID_LENGTH'); end if;
  if not exists (select 1 from public.game_words where length=v_match.length and word=v_guess) then return jsonb_build_object('ok',false,'error','WORD_NOT_ALLOWED'); end if;
  if exists (select 1 from public.match_guesses where match_id=p_match_id and word=v_guess) then return jsonb_build_object('ok',false,'error','ALREADY_GUESSED'); end if;
  if exists (select 1 from public.match_guesses where match_id=p_match_id and action_id=p_action_id) then
    select evaluation into v_eval from public.match_guesses where match_id=p_match_id and action_id=p_action_id;
    return jsonb_build_object('ok',true,'replayed',true,'evaluation',v_eval);
  end if;

  v_eval := public.evaluate_word(v_guess, v_match.answer);
  insert into public.match_guesses(match_id, action_id, user_id, turn_no, word, evaluation)
  values (p_match_id, p_action_id, v_user, v_match.turn_no, v_guess, v_eval);
  update public.match_participants set attempts=attempts+1 where match_id=p_match_id and user_id=v_user;

  select user_id into v_opponent from public.match_participants where match_id=p_match_id and user_id<>v_user;
  if v_guess = v_match.answer then
    v_winner := v_user;
    v_result := 'win';
    update public.match_sessions set status='won', winner_id=v_user, ended_at=now(), last_action_at=now(), active=false where id=p_match_id;
    update public.match_participants set active=false where match_id=p_match_id;
    v_settle := public.settle_ranked_match(p_match_id, v_winner, v_result);
  elsif v_match.turn_no + 1 >= v_match.max_attempts then
    v_result := 'draw';
    update public.match_sessions set status='draw', ended_at=now(), last_action_at=now(), active=false where id=p_match_id;
    update public.match_participants set active=false where match_id=p_match_id;
    v_settle := public.settle_ranked_match(p_match_id, null, 'draw');
  else
    update public.match_sessions set current_player=v_opponent, turn_no=turn_no+1, last_action_at=now() where id=p_match_id;
  end if;

  return jsonb_build_object('ok',true,'replayed',false,'evaluation',v_eval,
    'status',(select status from public.match_sessions where id=p_match_id),
    'winner_id',v_winner,'turn_no',(select turn_no from public.match_sessions where id=p_match_id));
exception
  when unique_violation then return jsonb_build_object('ok',false,'error','DUPLICATE_ACTION');
end;
$$;
revoke execute on function public.submit_match_guess(uuid, uuid, text) from public;
grant execute on function public.submit_match_guess(uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- Forfeit with the same ordered-lock settlement path.
-- ---------------------------------------------------------------------
create or replace function public.forfeit_match(p_match_id uuid, p_action_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_match public.match_sessions;
  v_winner uuid;
  v_settle jsonb;
begin
  if v_user is null then return jsonb_build_object('ok',false,'error','AUTH_REQUIRED'); end if;
  if p_action_id is null then return jsonb_build_object('ok',false,'error','INVALID_ACTION'); end if;
  select * into v_match from public.match_sessions
   where id=p_match_id and active=true and status='playing'
     and exists(select 1 from public.match_participants p where p.match_id=id and p.user_id=v_user and p.active=true)
   for update;
  if not found then return jsonb_build_object('ok',false,'error','MATCH_NOT_FOUND_OR_ENDED'); end if;
  select user_id into v_winner from public.match_participants where match_id=p_match_id and user_id<>v_user;
  update public.match_sessions set status='forfeited', winner_id=v_winner, ended_at=now(), last_action_at=now(), active=false where id=p_match_id;
  update public.match_participants set active=false where match_id=p_match_id;
  v_settle := public.settle_ranked_match(p_match_id, v_winner, 'win');
  return jsonb_build_object('ok',true,'status','forfeited','winner_id',v_winner,
    'elo_delta',coalesce(v_settle->>'elo_delta','0')::integer);
end;
$$;
revoke execute on function public.forfeit_match(uuid, uuid) from public;
grant execute on function public.forfeit_match(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Read state never exposes the answer.
-- ---------------------------------------------------------------------
create or replace function public.get_match_state(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_match public.match_sessions;
  v_guesses jsonb;
begin
  if v_user is null then return jsonb_build_object('ok',false,'error','AUTH_REQUIRED'); end if;
  select m.* into v_match from public.match_sessions m
   where m.id=p_match_id
     and exists(select 1 from public.match_participants p where p.match_id=m.id and p.user_id=v_user)
   for update;
  if not found then return jsonb_build_object('ok',false,'error','MATCH_NOT_FOUND'); end if;
  if v_match.active and v_match.last_action_at < now() - interval '5 minutes' then
    update public.match_sessions set active=false, status='draw', ended_at=now(), last_action_at=now() where id=p_match_id;
    update public.match_participants set active=false where match_id=p_match_id;
    perform public.settle_ranked_match(p_match_id, null, 'draw');
    select * into v_match from public.match_sessions where id=p_match_id;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('user_id',user_id,'turn_no',turn_no,'word',word,'evaluation',evaluation) order by turn_no),'[]'::jsonb)
    into v_guesses from public.match_guesses where match_id=p_match_id;
  return jsonb_build_object('ok',true,'id',v_match.id,'length',v_match.length,'status',v_match.status,
    'current_player',v_match.current_player,'turn_no',v_match.turn_no,'winner_id',v_match.winner_id,'guesses',v_guesses);
end;
$$;
revoke execute on function public.get_match_state(uuid) from public;
grant execute on function public.get_match_state(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Safe server-side economy purchase. The client sends only item id and the
-- server reads the canonical price from a server catalog table.
-- ---------------------------------------------------------------------
create table if not exists public.shop_catalog (
  item_id text primary key,
  currency text not null check (currency in ('coins','gems')),
  price integer not null check (price >= 0),
  enabled boolean not null default true
);
alter table public.shop_catalog enable row level security;
revoke all on public.shop_catalog from anon, authenticated;
grant select on public.shop_catalog to authenticated;
drop policy if exists shop_catalog_read on public.shop_catalog;
create policy shop_catalog_read on public.shop_catalog for select to authenticated using (enabled=true);

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
  v_currency text;
begin
  if v_user is null then return jsonb_build_object('ok',false,'error','AUTH_REQUIRED'); end if;
  select * into v_item from public.shop_catalog where item_id=p_item_id and enabled=true;
  if not found then return jsonb_build_object('ok',false,'error','ITEM_NOT_FOUND'); end if;
  if exists(select 1 from public.inventory where user_id=v_user and item_id=p_item_id) then
    return jsonb_build_object('ok',true,'already_owned',true);
  end if;
  select case when v_item.currency='coins' then coins else gems end into v_balance from public.profiles where id=v_user for update;
  if v_balance < v_item.price then return jsonb_build_object('ok',false,'error','INSUFFICIENT_FUNDS'); end if;
  if v_item.currency='coins' then
    update public.profiles set coins=coins-v_item.price where id=v_user;
  else
    update public.profiles set gems=gems-v_item.price where id=v_user;
  end if;
  insert into public.inventory(user_id,item_id) values(v_user,p_item_id);
  return jsonb_build_object('ok',true,'item_id',p_item_id,'currency',v_item.currency,'price',v_item.price);
exception
  when unique_violation then return jsonb_build_object('ok',true,'already_owned',true);
end;
$$;
revoke execute on function public.purchase_cosmetic(text) from public;
grant execute on function public.purchase_cosmetic(text) to authenticated;

-- Prevent direct inventory mutation even if a future policy is accidentally added.
revoke insert, update, delete on public.inventory from anon, authenticated;

-- Default privileges: newly-created public functions are not automatically
-- callable by browser roles. Explicit grants above are the allow-list.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

commit;
