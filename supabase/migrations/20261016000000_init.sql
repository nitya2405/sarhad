-- Sarhad phase 2: one official daily attempt per player per IST date.
-- Players are silent Supabase anonymous identities (role `authenticated`); the player id is
-- always auth.uid(), never a value the client sends.
-- Clients can only SELECT their own rows. Every write goes through:
--   start_daily()          security definer, callable by authenticated
--   set_display_name(text) security definer, callable by authenticated
--   finish_daily_commit()  security definer, callable ONLY by service_role (the finish-daily Edge Function)

-- ---------------------------------------------------------------- tables

create table public.players (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 3 and 20),
  is_default_name boolean not null default true,
  created_at timestamptz not null default now()
);

-- Seeded by a generated migration from src/data/daily.json. Past dates are never edited.
create table public.daily_schedule (
  ist_date date primary key,
  puzzle_id text not null,
  start_id text not null,
  end_id text not null,
  k int not null check (k between 2 and 6)
);

create table public.daily_attempts (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  ist_date date not null references public.daily_schedule (ist_date),
  puzzle_id text not null,
  started_at timestamptz not null default now(),          -- server clock
  finished_at timestamptz,
  status text not null default 'playing' check (status in ('playing', 'won', 'lost')),
  guesses text[] not null default '{}',
  time_ms int check (time_ms >= 0),
  points int check (points >= 0),
  constraint daily_attempts_one_per_day unique (player_id, ist_date),
  constraint daily_attempts_guess_cap check (cardinality(guesses) <= 20),
  constraint daily_attempts_finished check ((status = 'playing') = (finished_at is null))
);

create index daily_attempts_board_idx on public.daily_attempts (ist_date, status, time_ms);

-- ---------------------------------------------------------------- privileges + RLS

alter table public.players enable row level security;
alter table public.daily_schedule enable row level security;
alter table public.daily_attempts enable row level security;

-- New projects may expose public tables by default: take everything away, then grant read only.
revoke all on table public.players, public.daily_schedule, public.daily_attempts from public, anon, authenticated;
grant select on table public.players, public.daily_schedule, public.daily_attempts to authenticated;
grant select on table public.players, public.daily_schedule, public.daily_attempts to service_role;

create policy players_select_own on public.players
  for select to authenticated using (id = (select auth.uid()));

create policy daily_attempts_select_own on public.daily_attempts
  for select to authenticated using (player_id = (select auth.uid()));

-- Only today and past dates. The schedule also ships in the app bundle, so this is tidiness,
-- not secrecy; it keeps the API from listing future puzzles.
create policy daily_schedule_select_past on public.daily_schedule
  for select to authenticated using (ist_date <= (now() at time zone 'Asia/Kolkata')::date);

-- No insert / update / delete policies on any table.

-- ---------------------------------------------------------------- start_daily

create or replace function public.start_daily()
returns table (
  attempt_id uuid,
  ist_date date,
  puzzle_id text,
  start_id text,
  end_id text,
  k int,
  started_at timestamptz,
  status text
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_sched public.daily_schedule;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into v_sched from public.daily_schedule s where s.ist_date = v_today;
  if not found then
    raise exception 'no puzzle scheduled for %', v_today using errcode = 'P0002';
  end if;

  insert into public.players (id, display_name)
  values (v_uid, 'Player ' || upper(substr(replace(v_uid::text, '-', ''), 1, 4)))
  on conflict (id) do nothing;

  -- Race-safe: two tabs / two calls end up with the same row and the same started_at.
  insert into public.daily_attempts (player_id, ist_date, puzzle_id)
  values (v_uid, v_today, v_sched.puzzle_id)
  on conflict on constraint daily_attempts_one_per_day do nothing;

  return query
    select a.id, a.ist_date, a.puzzle_id, s.start_id, s.end_id, s.k, a.started_at, a.status
    from public.daily_attempts a
    join public.daily_schedule s on s.ist_date = a.ist_date
    where a.player_id = v_uid and a.ist_date = v_today;
end;
$$;

-- ---------------------------------------------------------------- set_display_name

create or replace function public.set_display_name(p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if char_length(v_name) not between 3 and 20 then
    raise exception 'display name must be 3–20 characters' using errcode = '22023';
  end if;
  if v_name ~ '[[:cntrl:]]' then
    raise exception 'display name has invalid characters' using errcode = '22023';
  end if;

  insert into public.players (id, display_name, is_default_name)
  values (v_uid, v_name, false)
  on conflict (id) do update set display_name = excluded.display_name, is_default_name = false;
end;
$$;

-- ---------------------------------------------------------------- finish_daily_commit (service_role only)

-- The finish-daily Edge Function verifies the caller, replays the guesses with the shared engine,
-- and calls this to write the result. One-way: a finished attempt is returned unchanged, so a
-- retry after a timeout is safe without an idempotency key.
create or replace function public.finish_daily_commit(
  p_attempt_id uuid,
  p_player_id uuid,
  p_guesses text[],
  p_status text,
  p_time_ms int,
  p_points int
)
returns public.daily_attempts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.daily_attempts;
  v_sched public.daily_schedule;
begin
  select * into v_row from public.daily_attempts a where a.id = p_attempt_id for update;
  if not found then
    raise exception 'attempt not found' using errcode = 'P0002';
  end if;
  if v_row.player_id is distinct from p_player_id then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  if v_row.status <> 'playing' then
    return v_row;                                   -- already finished: stored result, unchanged
  end if;

  -- Defence in depth; the Edge Function has already validated with the engine.
  if p_status not in ('won', 'lost') then
    raise exception 'bad status' using errcode = '22023';
  end if;
  if p_guesses is null or cardinality(p_guesses) > 20 then
    raise exception 'too_many' using errcode = '22023';
  end if;
  if cardinality(p_guesses) <> (select count(distinct g) from unnest(p_guesses) g) then
    raise exception 'duplicate' using errcode = '22023';
  end if;
  if not (p_guesses <@ public.playable_region_ids()) then
    raise exception 'unknown' using errcode = '22023';
  end if;
  select * into v_sched from public.daily_schedule s where s.ist_date = v_row.ist_date;
  if v_sched.start_id = any (p_guesses) or v_sched.end_id = any (p_guesses) then
    raise exception 'endpoint' using errcode = '22023';
  end if;
  if p_status = 'won' and (p_time_ms is null or p_time_ms < 0 or p_points is null or p_points < 0) then
    raise exception 'bad score' using errcode = '22023';
  end if;

  update public.daily_attempts a
  set status = p_status,
      guesses = p_guesses,
      finished_at = now(),
      time_ms = case when p_status = 'won' then p_time_ms end,
      points = case when p_status = 'won' then p_points else 0 end
  where a.id = p_attempt_id and a.status = 'playing'
  returning * into v_row;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------- get_daily_board

-- Top 50 winners for a date (time, then fewer guesses, then earlier finish) with display names,
-- plus the caller's rank. Exposes no player ids and no guesses.
create or replace function public.get_daily_board(p_date date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with ranked as (
    select a.player_id,
           p.display_name,
           a.time_ms,
           cardinality(a.guesses) as n_guesses,
           row_number() over (order by a.time_ms, cardinality(a.guesses), a.finished_at, a.id) as rank
    from public.daily_attempts a
    join public.players p on p.id = a.player_id
    where a.ist_date = p_date and a.status = 'won'
  )
  select jsonb_build_object(
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
               'rank', r.rank,
               'display_name', r.display_name,
               'time_ms', r.time_ms,
               'n_guesses', r.n_guesses,
               'is_me', r.player_id = auth.uid())
             order by r.rank)
      from ranked r
      where r.rank <= 50), '[]'::jsonb),
    'my_rank', (select r.rank from ranked r where r.player_id = auth.uid())
  );
$$;

-- ---------------------------------------------------------------- function grants

revoke all on function public.start_daily() from public, anon;
revoke all on function public.set_display_name(text) from public, anon;
revoke all on function public.get_daily_board(date) from public, anon;
revoke all on function public.finish_daily_commit(uuid, uuid, text[], text, int, int) from public, anon, authenticated;

grant execute on function public.start_daily() to authenticated;
grant execute on function public.set_display_name(text) to authenticated;
grant execute on function public.get_daily_board(date) to authenticated;
grant execute on function public.finish_daily_commit(uuid, uuid, text[], text, int, int) to service_role;
