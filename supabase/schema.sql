-- Roadmap Rumble — schema
--
-- Run this whole file in the Supabase SQL editor. It is idempotent.
--
-- Design note on trust: clients hold only the anon key, and they can SELECT
-- game state but cannot write any of it. Every mutation goes through a
-- SECURITY DEFINER function. The `votes` table has RLS on and *no policies at
-- all*, so a client cannot read individual votes even if it tries — which is
-- what makes "votes reveal simultaneously" true rather than cosmetic. Tallies
-- only become visible when `resolve_matchup` copies them onto the matchup row.
--
-- This is a demo posture, not a production one: anyone with a room code can
-- call the RPCs. There are no accounts, by design.

-- ---------------------------------------------------------------- tables ---

create table if not exists public.rr_sessions (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null unique,
  -- lobby | running | finished
  status              text not null default 'lobby',
  current_matchup_id  uuid,
  round               int  not null default 0,
  total_rounds        int  not null default 5,
  -- Vote window and discussion timer, in seconds. Host-tunable per session.
  vote_seconds        int  not null default 20,
  discussion_seconds  int  not null default 180,
  -- A matchup is "lopsided" at or above this share; below it the room is split.
  lopsided_threshold  real not null default 0.70,
  created_at          timestamptz not null default now(),
  finished_at         timestamptz
);

create table if not exists public.rr_participants (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.rr_sessions(id) on delete cascade,
  name        text not null,
  is_host     boolean not null default false,
  is_bot      boolean not null default false,
  -- revenue | recency | underdog — see src/lib/game/bots.ts
  bot_bias    text,
  joined_at   timestamptz not null default now()
);

create index if not exists rr_participants_session_idx
  on public.rr_participants (session_id);

create table if not exists public.rr_champions (
  id                uuid primary key default gen_random_uuid(),
  session_id        uuid not null references public.rr_sessions(id) on delete cascade,
  -- Stable across sessions. Seeds the deterministic character composition, so
  -- the same feature always renders as the identical champion.
  feature_key       text not null,
  name              text not null,
  description       text not null,
  calls             int    not null default 0,
  lost_deals        int    not null default 0,
  revenue_at_stake  bigint not null default 0,
  first_mentioned   date   not null,
  -- mined | human. Hidden by the client until the results screen.
  origin            text   not null,
  submitted_by      text,
  rating            real   not null default 1500,
  played            int    not null default 0,
  wins              int    not null default 0,
  losses            int    not null default 0,
  draws             int    not null default 0,
  created_at        timestamptz not null default now(),
  unique (session_id, feature_key)
);

create index if not exists rr_champions_session_idx
  on public.rr_champions (session_id);

create table if not exists public.rr_matchups (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references public.rr_sessions(id) on delete cascade,
  round           int  not null,
  order_in_round  int  not null,
  champion_a      uuid not null references public.rr_champions(id) on delete cascade,
  champion_b      uuid not null references public.rr_champions(id) on delete cascade,
  -- pending | open | resolved
  status          text not null default 'pending',
  -- Live count of ballots received. Deliberately does NOT reveal the split.
  votes_cast      int  not null default 0,
  -- Populated only at resolution.
  votes_a         int,
  votes_b         int,
  winner          uuid references public.rr_champions(id),
  contested       boolean not null default false,
  argument_a      text,
  argument_b      text,
  commentary      text,
  -- Set when this matchup is a re-vote of an earlier contested one.
  revote_of       uuid references public.rr_matchups(id),
  opened_at       timestamptz,
  resolved_at     timestamptz,
  created_at      timestamptz not null default now(),
  check (champion_a <> champion_b)
);

create index if not exists rr_matchups_session_idx
  on public.rr_matchups (session_id, round, order_in_round);

create table if not exists public.rr_votes (
  id              uuid primary key default gen_random_uuid(),
  matchup_id      uuid not null references public.rr_matchups(id) on delete cascade,
  participant_id  uuid not null references public.rr_participants(id) on delete cascade,
  choice          uuid not null references public.rr_champions(id) on delete cascade,
  created_at      timestamptz not null default now(),
  -- One ballot per person per matchup. Two browser windows racing the same
  -- participant id produce one row, not two.
  unique (matchup_id, participant_id)
);

do $$ begin
  alter table public.rr_sessions
    add constraint rr_sessions_current_matchup_fk
    foreign key (current_matchup_id) references public.rr_matchups(id) on delete set null;
exception when duplicate_object then null;
end $$;

-- ------------------------------------------------------------------ rls ---

alter table public.rr_sessions     enable row level security;
alter table public.rr_participants enable row level security;
alter table public.rr_champions    enable row level security;
alter table public.rr_matchups     enable row level security;
alter table public.rr_votes        enable row level security;

-- Read-only for clients. All writes go through the functions below.
do $$
declare t text;
begin
  foreach t in array array['rr_sessions', 'rr_participants', 'rr_champions', 'rr_matchups'] loop
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format(
      'create policy %I on public.%I for select using (true)', t || '_read', t);
  end loop;
end $$;

-- public.rr_votes intentionally has NO policies: with RLS enabled and no policy,
-- anon can neither read nor write it. Only cast_vote (SECURITY DEFINER) can.

-- ------------------------------------------------------------- functions ---

create or replace function public.rr_gen_room_code()
returns text
language plpgsql
set search_path = public
as $$
declare
  -- No I, O, 0, 1 — these get read aloud on a call.
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  i int;
begin
  loop
    candidate := '';
    for i in 1..4 loop
      candidate := candidate ||
        substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.rr_sessions where code = candidate);
  end loop;
  return candidate;
end;
$$;

-- Creates the session and the host in one shot.
create or replace function public.rr_create_session(p_host_name text)
returns table (session_id uuid, code text, participant_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.rr_sessions;
  v_participant uuid;
begin
  insert into public.rr_sessions (code)
  values (public.rr_gen_room_code())
  returning * into v_session;

  insert into public.rr_participants (session_id, name, is_host)
  values (v_session.id, coalesce(nullif(trim(p_host_name), ''), 'Host'), true)
  returning id into v_participant;

  return query select v_session.id, v_session.code, v_participant;
end;
$$;

create or replace function public.rr_join_session(p_code text, p_name text)
returns table (session_id uuid, participant_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.rr_sessions;
  v_participant uuid;
begin
  select * into v_session
  from public.rr_sessions
  where code = upper(trim(p_code));

  if not found then
    raise exception 'No session with code %', p_code
      using errcode = 'no_data_found';
  end if;

  insert into public.rr_participants (session_id, name)
  values (v_session.id, coalesce(nullif(trim(p_name), ''), 'Guest'))
  returning id into v_participant;

  return query select v_session.id, v_participant;
end;
$$;

create or replace function public.rr_add_bot(
  p_session_id uuid,
  p_name       text,
  p_bias       text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_bias not in ('revenue', 'recency', 'underdog') then
    raise exception 'Unknown bot bias: %', p_bias;
  end if;

  insert into public.rr_participants (session_id, name, is_bot, bot_bias)
  values (p_session_id, p_name, true, p_bias)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.rr_remove_participant(p_participant_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.rr_participants
  where id = p_participant_id and is_host = false;
$$;

-- Loads the roster of champions for a session. Replaces any existing set, so
-- the host can re-run mining and add ideas until the session actually starts.
create or replace function public.rr_seed_champions(
  p_session_id uuid,
  p_champions  jsonb
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_count int;
begin
  select status into v_status from public.rr_sessions where id = p_session_id;
  if v_status is null then
    raise exception 'No such session';
  end if;
  if v_status <> 'lobby' then
    raise exception 'Champions are locked once the session starts';
  end if;

  delete from public.rr_champions where session_id = p_session_id;

  insert into public.rr_champions (
    session_id, feature_key, name, description,
    calls, lost_deals, revenue_at_stake, first_mentioned, origin, submitted_by
  )
  select
    p_session_id,
    c->>'featureKey',
    c->>'name',
    coalesce(c->>'description', ''),
    coalesce((c->>'calls')::int, 0),
    coalesce((c->>'lostDeals')::int, 0),
    coalesce((c->>'revenueAtStake')::bigint, 0),
    (c->>'firstMentioned')::date,
    coalesce(c->>'origin', 'human'),
    c->>'submittedBy'
  from jsonb_array_elements(p_champions) as c;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Pairings are computed in TypeScript (Swiss) and handed here as an ordered
-- array of {a, b} feature keys. Inserting them in one call keeps a round atomic.
create or replace function public.rr_create_round(
  p_session_id uuid,
  p_round      int,
  p_pairs      jsonb
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  delete from public.rr_matchups
  where session_id = p_session_id and round = p_round and status = 'pending';

  insert into public.rr_matchups (session_id, round, order_in_round, champion_a, champion_b)
  select
    p_session_id,
    p_round,
    (ord - 1)::int,
    ca.id,
    cb.id
  from jsonb_array_elements(p_pairs) with ordinality as t(pair, ord)
  join public.rr_champions ca
    on ca.session_id = p_session_id and ca.feature_key = t.pair->>'a'
  join public.rr_champions cb
    on cb.session_id = p_session_id and cb.feature_key = t.pair->>'b';

  get diagnostics v_count = row_count;

  update public.rr_sessions
  set status = 'running', round = p_round
  where id = p_session_id;

  return v_count;
end;
$$;

-- Opens a matchup for voting and points the session at it.
create or replace function public.rr_open_matchup(p_matchup_id uuid)
returns public.rr_matchups
language plpgsql
security definer
set search_path = public
as $$
declare
  v_matchup public.rr_matchups;
begin
  update public.rr_matchups
  set status = 'open', opened_at = now()
  where id = p_matchup_id and status = 'pending'
  returning * into v_matchup;

  if not found then
    select * into v_matchup from public.rr_matchups where id = p_matchup_id;
    return v_matchup;
  end if;

  update public.rr_sessions
  set current_matchup_id = v_matchup.id, round = v_matchup.round
  where id = v_matchup.session_id;

  return v_matchup;
end;
$$;

-- The non-negotiable one. Records a ballot and, when the room is complete,
-- resolves the matchup — all inside a single transaction, with the matchup row
-- locked so two simultaneous voters cannot both see "last vote" and double-resolve.
--
-- Returns the caller's view of the world: how many ballots are in, whether the
-- matchup resolved, and nothing at all about how anyone voted.
create or replace function public.rr_cast_vote(
  p_matchup_id     uuid,
  p_participant_id uuid,
  p_choice         uuid
)
returns table (
  accepted    boolean,
  votes_cast  int,
  voters      int,
  resolved    boolean,
  reason      text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_matchup public.rr_matchups;
  v_voters int;
  v_cast int;
  v_participant public.rr_participants;
begin
  -- Lock the matchup for the duration. Everything below is serialised per matchup.
  select * into v_matchup
  from public.rr_matchups
  where id = p_matchup_id
  for update;

  if not found then
    return query select false, 0, 0, false, 'no_such_matchup'::text;
    return;
  end if;

  if v_matchup.status <> 'open' then
    return query
      select false, v_matchup.votes_cast, 0, v_matchup.status = 'resolved',
             'matchup_not_open'::text;
    return;
  end if;

  select * into v_participant
  from public.rr_participants
  where id = p_participant_id and session_id = v_matchup.session_id;

  if not found then
    return query select false, v_matchup.votes_cast, 0, false, 'not_in_session'::text;
    return;
  end if;

  if p_choice <> v_matchup.champion_a and p_choice <> v_matchup.champion_b then
    return query select false, v_matchup.votes_cast, 0, false, 'choice_not_in_matchup'::text;
    return;
  end if;

  begin
    insert into public.rr_votes (matchup_id, participant_id, choice)
    values (p_matchup_id, p_participant_id, p_choice);
  exception when unique_violation then
    -- Second window, double click, retried request: all the same ballot.
    select count(*)::int into v_cast from public.rr_votes where matchup_id = p_matchup_id;
    return query select false, v_cast, 0, false, 'already_voted'::text;
    return;
  end;

  select count(*)::int into v_cast from public.rr_votes where matchup_id = p_matchup_id;

  update public.rr_matchups set votes_cast = v_cast where id = p_matchup_id;

  select count(*)::int into v_voters
  from public.rr_participants
  where session_id = v_matchup.session_id;

  -- Everyone is in: resolve now rather than waiting out the clock.
  if v_cast >= v_voters then
    perform public.rr_resolve_matchup(p_matchup_id);
    return query select true, v_cast, v_voters, true, 'resolved'::text;
    return;
  end if;

  return query select true, v_cast, v_voters, false, 'recorded'::text;
end;
$$;

-- Closes voting, reveals the tally, applies the rating change, and decides
-- whether the room was split. Safe to call twice; the second call is a no-op.
create or replace function public.rr_resolve_matchup(p_matchup_id uuid)
returns public.rr_matchups
language plpgsql
security definer
set search_path = public
as $$
declare
  v_matchup   public.rr_matchups;
  v_a int; v_b int; v_total int;
  v_share real;
  v_threshold real;
  v_contested boolean;
  v_winner uuid;
  v_rating_a real; v_rating_b real;
  v_expected_a real;
  v_score_a real;
  k constant real := 32;
begin
  select * into v_matchup
  from public.rr_matchups
  where id = p_matchup_id
  for update;

  if not found or v_matchup.status = 'resolved' then
    return v_matchup;
  end if;

  select
    count(*) filter (where choice = v_matchup.champion_a)::int,
    count(*) filter (where choice = v_matchup.champion_b)::int
  into v_a, v_b
  from public.rr_votes
  where matchup_id = p_matchup_id;

  v_total := v_a + v_b;

  select lopsided_threshold into v_threshold
  from public.rr_sessions where id = v_matchup.session_id;

  if v_total = 0 then
    -- Nobody voted. Record it and move on without touching ratings.
    update public.rr_matchups
    set status = 'resolved', votes_a = 0, votes_b = 0, votes_cast = 0,
        winner = null, contested = false, resolved_at = now()
    where id = p_matchup_id
    returning * into v_matchup;
    return v_matchup;
  end if;

  v_share := greatest(v_a, v_b)::real / v_total::real;
  -- A split room is the whole point of the product, so this is where the
  -- session stops and the discussion timer goes up.
  v_contested := v_share < v_threshold;

  if v_a > v_b then
    v_winner := v_matchup.champion_a;
    v_score_a := 1;
  elsif v_b > v_a then
    v_winner := v_matchup.champion_b;
    v_score_a := 0;
  else
    v_winner := null;
    v_score_a := 0.5;
  end if;

  select rating into v_rating_a from public.rr_champions where id = v_matchup.champion_a;
  select rating into v_rating_b from public.rr_champions where id = v_matchup.champion_b;

  v_expected_a := 1.0 / (1.0 + power(10.0, (v_rating_b - v_rating_a) / 400.0));

  update public.rr_champions
  set rating = rating + k * (v_score_a - v_expected_a),
      played = played + 1,
      wins   = wins   + (case when v_score_a = 1 then 1 else 0 end),
      losses = losses + (case when v_score_a = 0 then 1 else 0 end),
      draws  = draws  + (case when v_score_a = 0.5 then 1 else 0 end)
  where id = v_matchup.champion_a;

  update public.rr_champions
  set rating = rating + k * ((1 - v_score_a) - (1 - v_expected_a)),
      played = played + 1,
      wins   = wins   + (case when v_score_a = 0 then 1 else 0 end),
      losses = losses + (case when v_score_a = 1 then 1 else 0 end),
      draws  = draws  + (case when v_score_a = 0.5 then 1 else 0 end)
  where id = v_matchup.champion_b;

  update public.rr_matchups
  set status = 'resolved',
      votes_a = v_a,
      votes_b = v_b,
      votes_cast = v_total,
      winner = v_winner,
      contested = v_contested,
      resolved_at = now()
  where id = p_matchup_id
  returning * into v_matchup;

  return v_matchup;
end;
$$;

create or replace function public.rr_record_arguments(
  p_matchup_id uuid,
  p_argument_a text,
  p_argument_b text
)
returns public.rr_matchups
language plpgsql
security definer
set search_path = public
as $$
declare
  v_matchup public.rr_matchups;
begin
  update public.rr_matchups
  set argument_a = nullif(trim(coalesce(p_argument_a, '')), ''),
      argument_b = nullif(trim(coalesce(p_argument_b, '')), '')
  where id = p_matchup_id
  returning * into v_matchup;
  return v_matchup;
end;
$$;

create or replace function public.rr_set_commentary(p_matchup_id uuid, p_line text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.rr_matchups set commentary = p_line where id = p_matchup_id;
$$;

-- Queues a re-vote of a contested matchup as a fresh, unvoted pairing.
create or replace function public.rr_create_revote(p_matchup_id uuid)
returns public.rr_matchups
language plpgsql
security definer
set search_path = public
as $$
declare
  v_src public.rr_matchups;
  v_new public.rr_matchups;
  v_order int;
begin
  select * into v_src from public.rr_matchups where id = p_matchup_id;
  if not found then
    raise exception 'No such matchup';
  end if;

  select coalesce(max(order_in_round), 0) + 1 into v_order
  from public.rr_matchups
  where session_id = v_src.session_id and round = v_src.round;

  insert into public.rr_matchups (
    session_id, round, order_in_round, champion_a, champion_b, revote_of
  )
  values (
    v_src.session_id, v_src.round, v_order, v_src.champion_a, v_src.champion_b, v_src.id
  )
  returning * into v_new;

  return v_new;
end;
$$;

create or replace function public.rr_finish_session(p_session_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.rr_sessions
  set status = 'finished', finished_at = now(), current_matchup_id = null
  where id = p_session_id;
$$;

-- ------------------------------------------------------------- realtime ---

do $$ begin
  alter publication supabase_realtime add table public.rr_sessions;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.rr_participants;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.rr_champions;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.rr_matchups;
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------- grants ---

grant execute on function
  public.rr_create_session(text),
  public.rr_join_session(text, text),
  public.rr_add_bot(uuid, text, text),
  public.rr_remove_participant(uuid),
  public.rr_seed_champions(uuid, jsonb),
  public.rr_create_round(uuid, int, jsonb),
  public.rr_open_matchup(uuid),
  public.rr_cast_vote(uuid, uuid, uuid),
  public.rr_resolve_matchup(uuid),
  public.rr_record_arguments(uuid, text, text),
  public.rr_set_commentary(uuid, text),
  public.rr_create_revote(uuid),
  public.rr_finish_session(uuid)
to anon, authenticated;

-- gen_room_code is an internal helper; clients never call it directly.
revoke execute on function public.rr_gen_room_code() from anon, authenticated;

-- Host-tunable pacing. A 20-second window is right for a real meeting and far
-- too slow to record eight matchups against, so the demo needs to be able to
-- run the same game faster without changing any of its rules.
create or replace function public.rr_set_pace(
  p_session_id        uuid,
  p_vote_seconds      int,
  p_discussion_seconds int
)
returns public.rr_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.rr_sessions;
begin
  update public.rr_sessions
  set vote_seconds = greatest(4, least(120, p_vote_seconds)),
      discussion_seconds = greatest(15, least(600, p_discussion_seconds))
  where id = p_session_id and status = 'lobby'
  returning * into v_session;

  if not found then
    select * into v_session from public.rr_sessions where id = p_session_id;
  end if;

  return v_session;
end;
$$;

grant execute on function public.rr_set_pace(uuid, int, int) to anon, authenticated;
