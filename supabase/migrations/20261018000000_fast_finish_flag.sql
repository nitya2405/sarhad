-- Fast-finish guard. A win faster than 1.5 s + 1 s per guess is not humanly typed: it is stored as
-- usual (status, time, points), but flagged and kept off the public board. The player still sees their
-- own flagged result ("under review").

alter table public.daily_attempts add column flagged boolean not null default false;

-- Same as in 20261016000000_init.sql, plus: flagged = won and time_ms < 1500 + 1000 × number of guesses.
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
      points = case when p_status = 'won' then p_points else 0 end,
      flagged = (p_status = 'won' and p_time_ms < 1500 + 1000 * cardinality(p_guesses))
  where a.id = p_attempt_id and a.status = 'playing'
  returning * into v_row;

  return v_row;
end;
$$;

-- Same as before, but flagged wins are not ranked or listed. The caller's own flagged win comes back
-- separately as my_review, so their screen can say "under review".
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
    where a.ist_date = p_date and a.status = 'won' and not a.flagged
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
    'my_rank', (select r.rank from ranked r where r.player_id = auth.uid()),
    'my_review', (
      select jsonb_build_object('time_ms', a.time_ms, 'n_guesses', cardinality(a.guesses))
      from public.daily_attempts a
      where a.ist_date = p_date and a.player_id = auth.uid() and a.status = 'won' and a.flagged)
  );
$$;
