-- =====================================================================
-- LOUTRIS — production schema
-- Run once in: Dashboard → SQL Editor → New query → Run
-- Covers accounts, ranked stats, matches, leaderboards, team war,
-- friends, inventory. The full game state blob also lives on profiles.
-- =====================================================================

-- ---------------------------------------------------------------------
-- ACCOUNTS — one permanent row per auth user
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,                          -- game name (uppercased)
  display_name text,
  avatar text not null default 'LX',
  country text,                                  -- for the country leaderboard
  team text check (team in ('blue', 'red')),     -- permanent Blue/Red side
  elo int not null default 1000,
  peak_elo int not null default 1000,
  season_elo int not null default 1000,
  season int not null default 1,
  wins int not null default 0,
  losses int not null default 0,
  draws int not null default 0,
  streak int not null default 0,
  best_streak int not null default 0,
  placement_done boolean not null default false,
  xp int not null default 0,
  level int not null default 1,
  coins int not null default 0,
  gems int not null default 0,
  team_contribution int not null default 0,
  games_played int not null default 0,
  settings jsonb not null default '{}'::jsonb,
  data jsonb not null default '{}'::jsonb,       -- full game state blob
  created_at timestamptz not null default now(),
  last_online timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- auto-create a profile row whenever any auth user is created
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- keep updated_at fresh on every change
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- RLS: every player owns their row
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_delete_own" on public.profiles;

create policy "profiles_update_settings" on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- leaderboard + lookups
create index if not exists profiles_elo_idx on public.profiles (elo desc);
create index if not exists profiles_peak_elo_idx on public.profiles (peak_elo desc);
create index if not exists profiles_wins_idx on public.profiles (wins desc);
create index if not exists profiles_xp_idx on public.profiles (xp desc);
create index if not exists profiles_season_elo_idx on public.profiles (season_elo desc);
create index if not exists profiles_country_idx on public.profiles (country);
create index if not exists profiles_team_idx on public.profiles (team);
create index if not exists profiles_last_online_idx on public.profiles (last_online desc);

-- ---------------------------------------------------------------------
-- MATCHES — every match, any mode
-- ---------------------------------------------------------------------
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references auth.users(id) on delete cascade,
  my_name text,
  my_team text,
  opp_name text,
  mode text not null default 'multiplayer',
  ranked boolean not null default false,
  season int not null default 1,
  won boolean not null default false,
  draw boolean not null default false,
  elo_before int,
  elo_after int,
  elo_delta int not null default 0,
  guesses int not null default 0,
  guess_history jsonb,
  duration_ms int,
  word text,
  played_at timestamptz not null default now()
);

alter table public.matches enable row level security;

drop policy if exists "matches_insert" on public.matches;
drop policy if exists "matches_select" on public.matches;

create index if not exists matches_player_idx on public.matches (player_id, played_at desc);
create index if not exists matches_season_idx on public.matches (season);

revoke all on public.matches from anon, authenticated;

-- ---------------------------------------------------------------------
-- FRIENDS — name-based friend list (own rows)
-- ---------------------------------------------------------------------
create table if not exists public.friends (
  user_id uuid not null references auth.users(id) on delete cascade,
  friend_name text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'blocked')),
  friend_elo int not null default 0,
  friend_avatar text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, friend_name)
);

alter table public.friends enable row level security;

drop policy if exists "friends_select_own" on public.friends;
create policy "friends_select_own" on public.friends
  for select using (auth.uid() = user_id);

drop policy if exists "friends_insert_own" on public.friends;
create policy "friends_insert_own" on public.friends
  for insert with check (auth.uid() = user_id);

drop policy if exists "friends_update_own" on public.friends;
create policy "friends_update_own" on public.friends
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "friends_delete_own" on public.friends;
create policy "friends_delete_own" on public.friends
  for delete using (auth.uid() = user_id);

drop trigger if exists trg_friends_updated on public.friends;
create trigger trg_friends_updated
  before update on public.friends
  for each row execute function public.set_updated_at();

create index if not exists friends_user_idx on public.friends (user_id);

revoke insert, update, delete on public.friends from anon, authenticated;

-- ---------------------------------------------------------------------
-- INVENTORY — owned cosmetics
-- ---------------------------------------------------------------------
create table if not exists public.inventory (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null,
  acquired_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

alter table public.inventory enable row level security;

drop policy if exists "inventory_select_own" on public.inventory;
create policy "inventory_select_own" on public.inventory
  for select using (auth.uid() = user_id);

drop policy if exists "inventory_insert_own" on public.inventory;
create policy "inventory_insert_own" on public.inventory
  for insert with check (auth.uid() = user_id);

drop policy if exists "inventory_delete_own" on public.inventory;
create policy "inventory_delete_own" on public.inventory
  for delete using (auth.uid() = user_id);

create index if not exists inventory_user_idx on public.inventory (user_id);

revoke insert, update, delete on public.inventory from anon, authenticated;

-- ---------------------------------------------------------------------
-- LEADERBOARDS — real data, public read-only.
-- Views are security-definer: they expose ONLY the whitelisted columns
-- below, never the private state blob.
-- ---------------------------------------------------------------------
create or replace view public.leaderboard_global with (security_invoker = false) as
  select id, username as name, display_name, avatar, country, elo, peak_elo, wins, xp, season_elo
  from public.profiles
  where username is not null;

create or replace view public.leaderboard_peak with (security_invoker = false) as
  select id, username as name, display_name, avatar, country, elo, peak_elo, wins, xp, season_elo
  from public.profiles
  where username is not null;

create or replace view public.leaderboard_wins with (security_invoker = false) as
  select id, username as name, display_name, avatar, country, elo, peak_elo, wins, xp, season_elo
  from public.profiles
  where username is not null;

create or replace view public.leaderboard_xp with (security_invoker = false) as
  select id, username as name, display_name, avatar, country, elo, peak_elo, wins, xp, season_elo
  from public.profiles
  where username is not null;

create or replace view public.leaderboard_season with (security_invoker = false) as
  select id, username as name, display_name, avatar, country, elo, peak_elo, wins, xp, season_elo
  from public.profiles
  where username is not null;

create or replace view public.leaderboard_country with (security_invoker = false) as
  select country,
         count(*) as players,
         sum(elo) as total_elo,
         max(elo) as top_elo,
         round(avg(elo)) as avg_elo
  from public.profiles
  where username is not null and country is not null
  group by country;

grant select on
  public.leaderboard_global, public.leaderboard_peak, public.leaderboard_wins,
  public.leaderboard_xp, public.leaderboard_season, public.leaderboard_country
  to anon, authenticated;

-- usernames only — lets clients check name availability and look up any
-- player without RLS issues (security_invoker=false bypasses RLS).
create or replace view public.usernames with (security_invoker = false) as
  select id, username, display_name, avatar, country, elo, wins, peak_elo, xp, team
  from public.profiles where username is not null;

grant select on public.usernames to anon, authenticated;

-- friend requests: both sides (sender + recipient) can read their requests;
-- only the sender can create one, both can accept/decline/cancel.
create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references auth.users(id) on delete cascade,
  to_id uuid not null references auth.users(id) on delete cascade,
  from_name text not null,
  to_name text not null,
  from_elo integer not null default 0,
  from_avatar text,
  to_elo integer not null default 0,
  to_avatar text,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (from_id, to_id)
);

alter table public.friend_requests enable row level security;

drop policy if exists "friend_requests_select" on public.friend_requests;
create policy "friend_requests_select" on public.friend_requests
  for select using (auth.uid() = from_id or auth.uid() = to_id);

drop policy if exists "friend_requests_insert" on public.friend_requests;
drop policy if exists "friend_requests_update" on public.friend_requests;
drop policy if exists "friend_requests_delete" on public.friend_requests;

grant select on public.friend_requests to authenticated;
revoke insert, update, delete on public.friend_requests from anon, authenticated;

drop policy if exists "friend_requests_select" on public.friend_requests;
create policy "friend_requests_select" on public.friend_requests
  for select to authenticated using (auth.uid() = from_id or auth.uid() = to_id);

-- ---------------------------------------------------------------------
-- TEAM WAR — Blue vs Red real totals
-- ---------------------------------------------------------------------
create or replace view public.team_stats with (security_invoker = false) as
  select team,
         count(*) as players,
         sum(elo) as total_elo,
         sum(team_contribution) as contribution
  from public.profiles
  where team is not null
  group by team;

grant select on public.team_stats to anon, authenticated;

-- =====================================================================
-- SECURITY HARDENING — authoritative writes and ranked match state
-- =====================================================================
-- The browser is an untrusted client. Progression, wallets, inventory,
-- match outcomes, and ranked values are server-owned and can only change
-- through the functions below.

revoke insert, update, delete on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;

revoke insert, select, update, delete on public.matches from anon, authenticated;

alter table public.profiles
  drop constraint if exists profiles_elo_nonnegative,
  drop constraint if exists profiles_peak_elo_nonnegative,
  drop constraint if exists profiles_season_elo_nonnegative,
  drop constraint if exists profiles_xp_nonnegative,
  drop constraint if exists profiles_level_positive,
  drop constraint if exists profiles_currency_nonnegative,
  drop constraint if exists profiles_stats_nonnegative;

alter table public.profiles
  add constraint profiles_elo_nonnegative check (elo >= 0),
  add constraint profiles_peak_elo_nonnegative check (peak_elo >= 0),
  add constraint profiles_season_elo_nonnegative check (season_elo >= 0),
  add constraint profiles_xp_nonnegative check (xp >= 0),
  add constraint profiles_level_positive check (level >= 1),
  add constraint profiles_currency_nonnegative check (coins >= 0 and gems >= 0),
  add constraint profiles_stats_nonnegative check (wins >= 0 and losses >= 0 and draws >= 0 and games_played >= 0);

create table if not exists public.game_words (
  length smallint not null check (length between 4 and 6),
  word text not null,
  is_answer boolean not null default false,
  primary key (length, word),
  check (word = lower(word)),
  check (word ~ '^[a-z]+$'),
  check (char_length(word) = length)
);

revoke all on public.game_words from anon, authenticated;

create table if not exists public.match_sessions (
  id uuid primary key default gen_random_uuid(),
  mode text not null check (mode in ('ranked', 'casual')),
  ranked boolean not null default true,
  length smallint not null check (length between 4 and 6),
  max_attempts smallint not null default 7 check (max_attempts between 1 and 12),
  answer text not null,
  status text not null default 'playing' check (status in ('playing', 'won', 'lost', 'draw', 'forfeited')),
  current_player uuid references auth.users(id) on delete set null,
  turn_no integer not null default 0 check (turn_no >= 0),
  winner_id uuid references auth.users(id) on delete set null,
  started_at timestamptz not null default now(),
  last_action_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  check (answer = lower(answer)),
  check (char_length(answer) = length)
);

create table if not exists public.match_participants (
  match_id uuid not null references public.match_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  player_no smallint not null check (player_no in (1, 2)),
  attempts integer not null default 0 check (attempts >= 0),
  primary key (match_id, user_id),
  unique (match_id, player_no)
);

create table if not exists public.match_guesses (
  match_id uuid not null references public.match_sessions(id) on delete cascade,
  action_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  turn_no integer not null check (turn_no >= 0),
  word text not null check (word = lower(word) and word ~ '^[a-z]+$'),
  evaluation jsonb not null,
  created_at timestamptz not null default now(),
  primary key (match_id, action_id),
  unique (match_id, turn_no)
);

create table if not exists public.match_settlements (
  match_id uuid primary key references public.match_sessions(id) on delete cascade,
  winner_id uuid references auth.users(id) on delete set null,
  result text not null check (result in ('win', 'loss', 'draw')),
  created_at timestamptz not null default now()
);

alter table public.match_sessions enable row level security;
alter table public.match_participants enable row level security;
alter table public.match_guesses enable row level security;
alter table public.match_settlements enable row level security;

revoke all on public.match_sessions, public.match_participants, public.match_guesses, public.match_settlements from anon, authenticated;

drop policy if exists "match_sessions_select_participant" on public.match_sessions;
drop policy if exists "match_participants_select_self" on public.match_participants;
drop policy if exists "match_guesses_select_participant" on public.match_guesses;
drop policy if exists "match_settlements_select_participant" on public.match_settlements;

create index if not exists match_participants_user_idx on public.match_participants (user_id, match_id);
create index if not exists match_sessions_active_idx on public.match_sessions (status, last_action_at);
create index if not exists match_guesses_user_idx on public.match_guesses (user_id, created_at desc);

create or replace function public.save_profile_settings(
  p_username text,
  p_display_name text,
  p_avatar text,
  p_country text,
  p_settings jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_username text := nullif(upper(trim(p_username)), '');
  v_country text := nullif(upper(trim(p_country)), '');
  v_profile public.profiles;
begin
  if v_user is null then raise exception using errcode = '28000', message = 'AUTH_REQUIRED'; end if;
  if v_username is not null and (char_length(v_username) > 14 or v_username !~ '^[A-Z0-9_]+$') then
    raise exception using errcode = '22023', message = 'INVALID_USERNAME';
  end if;
  if v_country is not null and v_country !~ '^[A-Z]{2}$' then
    raise exception using errcode = '22023', message = 'INVALID_COUNTRY';
  end if;

  update public.profiles
     set username = v_username,
         display_name = nullif(trim(p_display_name), ''),
         avatar = coalesce(nullif(trim(p_avatar), ''), avatar),
         country = v_country,
         team = coalesce(team, case when mod(get_byte(decode(md5(coalesce(v_username, v_user::text)), 'hex'), 0), 2) = 0 then 'blue' else 'red' end),
         settings = coalesce(p_settings, settings),
         last_online = now()
   where id = v_user
   returning * into v_profile;

  if not found then raise exception using errcode = 'P0002', message = 'PROFILE_NOT_FOUND'; end if;
  return jsonb_build_object(
    'id', v_profile.id,
    'username', v_profile.username,
    'display_name', v_profile.display_name,
    'avatar', v_profile.avatar,
    'country', v_profile.country,
    'settings', v_profile.settings
  );
exception
  when unique_violation then raise exception using errcode = '23505', message = 'USERNAME_TAKEN';
end; $$;

revoke execute on function public.save_profile_settings(text, text, text, text, jsonb) from public;
grant execute on function public.save_profile_settings(text, text, text, text, jsonb) to authenticated;

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
  if v_user is null then raise exception using errcode = '28000', message = 'AUTH_REQUIRED'; end if;
  if p_opponent is null or p_opponent = v_user then raise exception using errcode = '22023', message = 'INVALID_OPPONENT'; end if;
  if p_length not between 4 and 6 then raise exception using errcode = '22023', message = 'INVALID_LENGTH'; end if;
  if not exists (select 1 from auth.users where id = p_opponent) then raise exception using errcode = 'P0002', message = 'OPPONENT_NOT_FOUND'; end if;

  select word into v_answer from public.game_words where length = p_length and is_answer order by gen_random_uuid() limit 1;
  if v_answer is null then raise exception using errcode = 'P0001', message = 'WORD_POOL_UNAVAILABLE'; end if;

  insert into public.match_sessions(mode, ranked, length, answer, current_player)
  values ('ranked', true, p_length, v_answer, v_user)
  returning * into v_match;
  insert into public.match_participants(match_id, user_id, player_no) values (v_match.id, v_user, 1), (v_match.id, p_opponent, 2);
  return jsonb_build_object(
    'id', v_match.id,
    'mode', v_match.mode,
    'ranked', v_match.ranked,
    'length', v_match.length,
    'status', v_match.status,
    'current_player', v_match.current_player,
    'turn_no', v_match.turn_no,
    'started_at', v_match.started_at
  );
end; $$;

revoke execute on function public.start_ranked_match(uuid, smallint) from public;
grant execute on function public.start_ranked_match(uuid, smallint) to authenticated;

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
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'AUTH_REQUIRED'); end if;
  select m.* into v_match
    from public.match_sessions m
   where m.id = p_match_id
     and exists (select 1 from public.match_participants p where p.match_id = m.id and p.user_id = v_user);
  if not found then return jsonb_build_object('ok', false, 'error', 'MATCH_NOT_FOUND'); end if;
  select coalesce(jsonb_agg(jsonb_build_object('user_id', user_id, 'turn_no', turn_no, 'word', word, 'evaluation', evaluation) order by turn_no), '[]'::jsonb)
    into v_guesses from public.match_guesses where match_id = p_match_id;
  return jsonb_build_object(
    'ok', true,
    'id', v_match.id,
    'length', v_match.length,
    'status', v_match.status,
    'current_player', v_match.current_player,
    'turn_no', v_match.turn_no,
    'winner_id', v_match.winner_id,
    'guesses', v_guesses
  );
end; $$;

revoke execute on function public.get_match_state(uuid) from public;
grant execute on function public.get_match_state(uuid) to authenticated;

create or replace function public.evaluate_word(p_guess text, p_answer text)
returns jsonb
language plpgsql
immutable
as $$
declare
  v_result jsonb := '[]'::jsonb;
  v_remaining jsonb := '{}'::jsonb;
  v_i integer;
  v_ch text;
  v_count integer;
begin
  for v_i in 1..char_length(p_answer) loop
    v_ch := substr(p_answer, v_i, 1);
    v_remaining := jsonb_set(v_remaining, array[v_ch], to_jsonb(coalesce((v_remaining ->> v_ch)::integer, 0) + 1), true);
  end loop;
  for v_i in 1..char_length(p_answer) loop
    v_ch := substr(p_guess, v_i, 1);
    if v_ch = substr(p_answer, v_i, 1) then
      v_result := v_result || jsonb_build_object('letter', v_ch, 'state', 'correct');
      v_remaining := jsonb_set(v_remaining, array[v_ch], to_jsonb(coalesce((v_remaining ->> v_ch)::integer, 0) - 1), true);
    else
      v_result := v_result || jsonb_build_object('letter', v_ch, 'state', 'pending');
    end if;
  end loop;
  for v_i in 0..jsonb_array_length(v_result) - 1 loop
    if v_result -> v_i ->> 'state' = 'pending' then
      v_ch := v_result -> v_i ->> 'letter';
      v_count := coalesce((v_remaining ->> v_ch)::integer, 0);
      if v_count > 0 then
        v_result := jsonb_set(v_result, array[v_i::text, 'state'], '"present"');
        v_remaining := jsonb_set(v_remaining, array[v_ch], to_jsonb(v_count - 1), true);
      else
        v_result := jsonb_set(v_result, array[v_i::text, 'state'], '"absent"');
      end if;
    end if;
  end loop;
  return v_result;
end; $$;

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
  v_winner uuid;
  v_result text;
  v_delta integer := 0;
  v_player_elo integer;
  v_opp_elo integer;
  v_expected numeric;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'AUTH_REQUIRED'); end if;
  if p_action_id is null or p_match_id is null then return jsonb_build_object('ok', false, 'error', 'INVALID_ACTION'); end if;
  if v_guess !~ '^[a-z]+$' or char_length(v_guess) not between 4 and 6 then return jsonb_build_object('ok', false, 'error', 'INVALID_WORD'); end if;

  if exists (select 1 from public.match_guesses where match_id = p_match_id and action_id = p_action_id) then
    select evaluation into v_eval from public.match_guesses where match_id = p_match_id and action_id = p_action_id;
    return jsonb_build_object('ok', true, 'replayed', true, 'evaluation', v_eval);
  end if;

  select m.* into v_match
    from public.match_sessions m
   where m.id = p_match_id
     and exists (select 1 from public.match_participants p where p.match_id = m.id and p.user_id = v_user)
   for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'MATCH_NOT_FOUND'); end if;
  if v_match.status <> 'playing' then return jsonb_build_object('ok', false, 'error', 'MATCH_ENDED', 'status', v_match.status); end if;
  if v_match.current_player <> v_user then return jsonb_build_object('ok', false, 'error', 'NOT_YOUR_TURN'); end if;
  if char_length(v_guess) <> v_match.length then return jsonb_build_object('ok', false, 'error', 'INVALID_LENGTH'); end if;
  if not exists (select 1 from public.game_words where length = v_match.length and word = v_guess) then return jsonb_build_object('ok', false, 'error', 'WORD_NOT_ALLOWED'); end if;
  if exists (select 1 from public.match_guesses where match_id = p_match_id and word = v_guess) then return jsonb_build_object('ok', false, 'error', 'ALREADY_GUESSED'); end if;

  v_eval := public.evaluate_word(v_guess, v_match.answer);
  insert into public.match_guesses(match_id, action_id, user_id, turn_no, word, evaluation)
  values (p_match_id, p_action_id, v_user, v_match.turn_no, v_guess, v_eval);
  update public.match_participants set attempts = attempts + 1 where match_id = p_match_id and user_id = v_user;

  if v_guess = v_match.answer then
    v_winner := v_user; v_result := 'win';
    update public.match_sessions set status = 'won', winner_id = v_user, ended_at = now(), last_action_at = now() where id = p_match_id;
  elsif v_match.turn_no + 1 >= v_match.max_attempts then
    v_result := 'draw';
    update public.match_sessions set status = 'draw', ended_at = now(), last_action_at = now() where id = p_match_id;
  else
    select user_id into v_winner from public.match_participants where match_id = p_match_id and user_id <> v_user;
    update public.match_sessions set current_player = v_winner, turn_no = turn_no + 1, last_action_at = now() where id = p_match_id;
    v_winner := null;
  end if;

  if v_result is not null then
    insert into public.match_settlements(match_id, winner_id, result) values (p_match_id, v_winner, v_result);
    if v_result <> 'draw' then
      select elo into v_player_elo from public.profiles where id = v_user for update;
      select elo into v_opp_elo from public.profiles where id = (select user_id from public.match_participants where match_id = p_match_id and user_id <> v_user) for update;
      v_expected := 1 / (1 + power(10, (v_opp_elo - v_player_elo)::numeric / 400));
      v_delta := round(32 * ((case when v_winner = v_user then 1 else 0 end) - v_expected));
      update public.profiles set elo = greatest(0, elo + case when id = v_user then v_delta else -v_delta end), peak_elo = greatest(peak_elo, elo + case when id = v_user then v_delta else -v_delta end), wins = wins + case when v_winner = id then 1 else 0 end, losses = losses + case when v_winner is not null and v_winner <> id then 1 else 0 end, games_played = games_played + 1 where id in (v_user, (select user_id from public.match_participants where match_id = p_match_id and user_id <> v_user));
      perform public.award_battle_pass_xp_internal(v_user, 'MATCH_PLAYED', p_action_id);
      perform public.award_battle_pass_xp_internal((select user_id from public.match_participants where match_id = p_match_id and user_id <> v_user), 'MATCH_PLAYED', p_action_id);
      perform public.award_battle_pass_xp_internal(v_winner, 'MATCH_WON', gen_random_uuid());
    else
      update public.profiles set draws = draws + 1, games_played = games_played + 1 where id in (v_user, (select user_id from public.match_participants where match_id = p_match_id and user_id <> v_user));
      perform public.award_battle_pass_xp_internal(v_user, 'MATCH_PLAYED', p_action_id);
      perform public.award_battle_pass_xp_internal((select user_id from public.match_participants where match_id = p_match_id and user_id <> v_user), 'MATCH_PLAYED', p_action_id);
    end if;
  end if;

  return jsonb_build_object('ok', true, 'replayed', false, 'evaluation', v_eval, 'status', coalesce((select status from public.match_sessions where id = p_match_id), 'playing'), 'winner_id', v_winner, 'elo_delta', v_delta);
exception
  when unique_violation then return jsonb_build_object('ok', false, 'error', 'DUPLICATE_ACTION');
end; $$;

revoke execute on function public.submit_match_guess(uuid, uuid, text) from public;
grant execute on function public.submit_match_guess(uuid, uuid, text) to authenticated;

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
  v_player_elo integer;
  v_winner_elo integer;
  v_expected numeric;
  v_delta integer;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'AUTH_REQUIRED'); end if;
  if p_action_id is null then return jsonb_build_object('ok', false, 'error', 'INVALID_ACTION'); end if;
  select * into v_match from public.match_sessions where id = p_match_id and status = 'playing' and exists (select 1 from public.match_participants p where p.match_id = id and p.user_id = v_user) for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'MATCH_NOT_FOUND_OR_ENDED'); end if;
  select user_id into v_winner from public.match_participants where match_id = p_match_id and user_id <> v_user;
  update public.match_sessions set status = 'forfeited', winner_id = v_winner, ended_at = now(), last_action_at = now() where id = p_match_id;
  insert into public.match_settlements(match_id, winner_id, result) values (p_match_id, v_winner, 'win') on conflict do nothing;
  select elo into v_player_elo from public.profiles where id = v_user for update;
  select elo into v_winner_elo from public.profiles where id = v_winner for update;
  v_expected := 1 / (1 + power(10, (v_winner_elo - v_player_elo)::numeric / 400));
  v_delta := round(32 * (0 - v_expected));
  update public.profiles set elo = greatest(0, elo + v_delta), peak_elo = greatest(peak_elo, elo + v_delta), losses = losses + 1, games_played = games_played + 1 where id = v_user;
  update public.profiles set elo = greatest(0, elo - v_delta), peak_elo = greatest(peak_elo, elo - v_delta), wins = wins + 1, games_played = games_played + 1 where id = v_winner;
  perform public.award_battle_pass_xp_internal(v_user, 'MATCH_PLAYED', p_action_id);
  perform public.award_battle_pass_xp_internal(v_winner, 'MATCH_PLAYED', p_action_id);
  perform public.award_battle_pass_xp_internal(v_winner, 'MATCH_WON', gen_random_uuid());
  return jsonb_build_object('ok', true, 'status', 'forfeited', 'winner_id', v_winner, 'elo_delta', v_delta);
end; $$;

revoke execute on function public.forfeit_match(uuid, uuid) from public;
grant execute on function public.forfeit_match(uuid, uuid) to authenticated;

create or replace function public.send_friend_request(p_to_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from uuid := auth.uid();
  v_from_profile public.profiles;
  v_to_profile public.profiles;
  v_request public.friend_requests;
begin
  if v_from is null then return jsonb_build_object('ok', false, 'error', 'AUTH_REQUIRED'); end if;
  if p_to_id is null or p_to_id = v_from then return jsonb_build_object('ok', false, 'error', 'INVALID_RECIPIENT'); end if;
  select * into v_from_profile from public.profiles where id = v_from;
  select * into v_to_profile from public.profiles where id = p_to_id;
  if v_to_profile.id is null then return jsonb_build_object('ok', false, 'error', 'PLAYER_NOT_FOUND'); end if;
  insert into public.friend_requests(from_id, to_id, from_name, to_name, from_elo, from_avatar, to_elo, to_avatar)
  values (v_from, p_to_id, coalesce(v_from_profile.username, 'PLAYER'), coalesce(v_to_profile.username, 'PLAYER'), v_from_profile.elo, v_from_profile.avatar, v_to_profile.elo, v_to_profile.avatar)
  on conflict (from_id, to_id) do update set status = 'pending', updated_at = now()
  returning * into v_request;
  return jsonb_build_object('ok', true, 'id', v_request.id, 'status', v_request.status);
exception
  when unique_violation then return jsonb_build_object('ok', false, 'error', 'REQUEST_EXISTS');
end; $$;

revoke execute on function public.send_friend_request(uuid) from public;
grant execute on function public.send_friend_request(uuid) to authenticated;

create or replace function public.respond_friend_request(p_request_id uuid, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_request public.friend_requests;
  v_status text;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'AUTH_REQUIRED'); end if;
  select * into v_request from public.friend_requests where id = p_request_id and (from_id = v_user or to_id = v_user) for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'REQUEST_NOT_FOUND'); end if;
  if v_request.status <> 'pending' then return jsonb_build_object('ok', false, 'error', 'REQUEST_NOT_PENDING'); end if;
  if p_accept and v_request.to_id <> v_user then return jsonb_build_object('ok', false, 'error', 'RECIPIENT_ONLY'); end if;
  v_status := case when p_accept then 'accepted' else 'declined' end;
  update public.friend_requests set status = v_status, updated_at = now() where id = p_request_id;
  return jsonb_build_object('ok', true, 'status', v_status);
end; $$;

revoke execute on function public.respond_friend_request(uuid, boolean) from public;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;

create or replace function public.delete_friend_request(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_deleted integer;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'AUTH_REQUIRED'); end if;
  delete from public.friend_requests where id = p_request_id and (from_id = v_user or to_id = v_user) and status = 'pending';
  get diagnostics v_deleted = row_count;
  return jsonb_build_object('ok', v_deleted = 1);
end; $$;

revoke execute on function public.delete_friend_request(uuid) from public;
grant execute on function public.delete_friend_request(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- BATTLE PASS — server-owned progress and idempotent claims
-- ---------------------------------------------------------------------
create table if not exists public.battle_pass_seasons (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  max_level integer not null default 40 check (max_level between 1 and 100),
  xp_per_level integer not null default 1000 check (xp_per_level between 1 and 100000),
  premium_price_cents integer not null default 699 check (premium_price_cents >= 0),
  check (ends_at > starts_at)
);

create table if not exists public.battle_pass_rewards (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.battle_pass_seasons(id) on delete cascade,
  level integer not null check (level >= 1),
  track text not null check (track in ('FREE', 'PREMIUM')),
  type text not null check (type in ('COINS', 'COSMETIC', 'TITLE', 'BANNER', 'EMOTE')),
  item_key text,
  display_name text not null,
  description text,
  amount integer check (amount is null or amount > 0),
  unique (season_id, level, track)
);

create table if not exists public.battle_pass_progress (
  season_id uuid not null references public.battle_pass_seasons(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  xp integer not null default 0 check (xp >= 0),
  premium_owned boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (season_id, user_id)
);

create table if not exists public.battle_pass_claims (
  reward_id uuid not null references public.battle_pass_rewards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  claimed_at timestamptz not null default now(),
  primary key (reward_id, user_id)
);

create table if not exists public.battle_pass_xp_events (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.battle_pass_seasons(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  action_id uuid not null,
  source text not null check (source in ('MATCH_PLAYED', 'MATCH_WON')),
  awarded integer not null check (awarded >= 0),
  created_at timestamptz not null default now(),
  unique (season_id, user_id, action_id)
);

alter table public.battle_pass_seasons enable row level security;
alter table public.battle_pass_rewards enable row level security;
alter table public.battle_pass_progress enable row level security;
alter table public.battle_pass_claims enable row level security;
alter table public.battle_pass_xp_events enable row level security;
revoke all on public.battle_pass_seasons, public.battle_pass_rewards, public.battle_pass_progress, public.battle_pass_claims, public.battle_pass_xp_events from anon, authenticated;
grant select on public.battle_pass_seasons, public.battle_pass_rewards to authenticated;
grant select on public.battle_pass_progress, public.battle_pass_claims to authenticated;

drop policy if exists "battle_pass_xp_events_read_own" on public.battle_pass_xp_events;
drop policy if exists "battle_pass_seasons_read" on public.battle_pass_seasons;
drop policy if exists "battle_pass_rewards_read" on public.battle_pass_rewards;
drop policy if exists "battle_pass_progress_read_own" on public.battle_pass_progress;
drop policy if exists "battle_pass_claims_read_own" on public.battle_pass_claims;

create policy "battle_pass_xp_events_read_own" on public.battle_pass_xp_events for select to authenticated using (auth.uid() = user_id);
create policy "battle_pass_seasons_read" on public.battle_pass_seasons for select to authenticated using (true);
create policy "battle_pass_rewards_read" on public.battle_pass_rewards for select to authenticated using (true);
create policy "battle_pass_progress_read_own" on public.battle_pass_progress for select to authenticated using (auth.uid() = user_id);
create policy "battle_pass_claims_read_own" on public.battle_pass_claims for select to authenticated using (auth.uid() = user_id);

create or replace function public.award_battle_pass_xp_internal(p_user_id uuid, p_source text, p_action_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_season public.battle_pass_seasons;
  v_award integer;
  v_remaining integer;
  v_progress public.battle_pass_progress;
  v_today bigint;
  v_week bigint;
begin
  if p_user_id is null or p_action_id is null or p_source not in ('MATCH_PLAYED', 'MATCH_WON') then return jsonb_build_object('ok', false, 'error', 'INVALID_ACTION'); end if;
  select * into v_season from public.battle_pass_seasons where starts_at <= now() and ends_at > now() order by starts_at desc limit 1;
  if not found then return jsonb_build_object('ok', false, 'error', 'NO_ACTIVE_SEASON'); end if;
  insert into public.battle_pass_progress(season_id, user_id, xp) values (v_season.id, p_user_id, 0) on conflict do nothing;
  select * into v_progress from public.battle_pass_progress where season_id = v_season.id and user_id = p_user_id for update;
  if exists (select 1 from public.battle_pass_xp_events where season_id = v_season.id and user_id = p_user_id and action_id = p_action_id) then return jsonb_build_object('ok', true, 'awarded', 0, 'replayed', true); end if;
  v_award := case when p_source = 'MATCH_WON' then 100 else 50 end;
  select coalesce(sum(awarded), 0) into v_today from public.battle_pass_xp_events where season_id = v_season.id and user_id = p_user_id and created_at >= date_trunc('day', now());
  select coalesce(sum(awarded), 0) into v_week from public.battle_pass_xp_events where season_id = v_season.id and user_id = p_user_id and created_at >= date_trunc('week', now());
  v_remaining := greatest(0, least(1200 - v_today::integer, 6000 - v_week::integer));
  v_award := least(v_award, v_remaining);
  insert into public.battle_pass_xp_events(season_id, user_id, action_id, source, awarded) values (v_season.id, p_user_id, p_action_id, p_source, v_award);
  update public.battle_pass_progress set xp = least(v_season.max_level * v_season.xp_per_level, xp + v_award), updated_at = now() where season_id = v_season.id and user_id = p_user_id returning * into v_progress;
  return jsonb_build_object('ok', true, 'awarded', v_award, 'xp', v_progress.xp);
exception
  when unique_violation then return jsonb_build_object('ok', true, 'awarded', 0, 'replayed', true);
end; $$;

revoke execute on function public.award_battle_pass_xp_internal(uuid, text, uuid) from public, anon, authenticated;

create or replace function public.claim_battle_pass_reward(p_reward_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_reward public.battle_pass_rewards;
  v_season public.battle_pass_seasons;
  v_progress public.battle_pass_progress;
  v_level integer;
  v_claimed boolean;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'AUTH_REQUIRED'); end if;
  select r into v_reward from public.battle_pass_rewards r where r.id = p_reward_id;
  select s into v_season from public.battle_pass_seasons s where s.id = v_reward.season_id;
  if not found or v_season.starts_at > now() or v_season.ends_at <= now() then return jsonb_build_object('ok', false, 'error', 'REWARD_UNAVAILABLE'); end if;
  select * into v_progress from public.battle_pass_progress where season_id = v_season.id and user_id = v_user for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'NO_PROGRESS'); end if;
  v_level := least(v_season.max_level, floor(v_progress.xp::numeric / v_season.xp_per_level) + 1);
  if v_reward.level > v_level then return jsonb_build_object('ok', false, 'error', 'LEVEL_NOT_REACHED'); end if;
  if v_reward.track = 'PREMIUM' and not v_progress.premium_owned then return jsonb_build_object('ok', false, 'error', 'PREMIUM_REQUIRED'); end if;
  select exists(select 1 from public.battle_pass_claims where reward_id = p_reward_id and user_id = v_user) into v_claimed;
  if v_claimed then return jsonb_build_object('ok', true, 'already', true, 'reward', v_reward.display_name); end if;
  insert into public.battle_pass_claims(reward_id, user_id) values (p_reward_id, v_user);
  if v_reward.type = 'COINS' then
    update public.profiles set coins = coins + coalesce(v_reward.amount, 0) where id = v_user;
  elsif v_reward.item_key is not null then
    insert into public.inventory(user_id, item_id) values (v_user, v_reward.item_key) on conflict do nothing;
  end if;
  return jsonb_build_object('ok', true, 'already', false, 'reward', v_reward.display_name, 'type', v_reward.type, 'item_key', v_reward.item_key, 'amount', v_reward.amount);
end; $$;

revoke execute on function public.claim_battle_pass_reward(uuid) from public;
grant execute on function public.claim_battle_pass_reward(uuid) to authenticated;
