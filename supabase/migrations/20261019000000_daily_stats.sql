-- Leaderboard stats for one IST date: aggregates only (no player ids, no guess lists).
--   players          finished attempts (won or lost) that date
--   median_ms        median official time of the unflagged wins, null without any
--   faster_than_pct  share of the other finished players the caller beat (they lost, or won slower);
--                    null unless the caller has an unflagged win and at least one other player finished
--   top_state        the most-guessed state that date (ties: alphabetical id). It names a state on
--                    today's route, so it is returned only to a caller who has finished that date's
--                    daily, or for past dates; otherwise null.
create or replace function public.get_daily_stats(p_date date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with done as (
    select a.player_id, a.status, a.time_ms, cardinality(a.guesses) as n_guesses, a.flagged, a.guesses
    from public.daily_attempts a
    where a.ist_date = p_date and a.status in ('won', 'lost')
  ),
  me as (
    select d.* from done d where d.player_id = auth.uid()
  ),
  rivals as (
    select d.* from done d where d.player_id is distinct from auth.uid() and not d.flagged
  ),
  top as (
    select g.id, count(*) as n
    from done d, unnest(d.guesses) as g(id)
    group by g.id
    order by n desc, g.id
    limit 1
  )
  select jsonb_build_object(
    'players', (select count(*) from done),
    'median_ms', (
      select round(percentile_cont(0.5) within group (order by d.time_ms))::int
      from done d where d.status = 'won' and not d.flagged),
    'faster_than_pct', (
      select case when (select count(*) from rivals) = 0 then null
             else round(100.0 * count(*) filter (
                    where r.status = 'lost'
                       or r.time_ms > m.time_ms
                       or (r.time_ms = m.time_ms and r.n_guesses > m.n_guesses))
                  / (select count(*) from rivals))::int end
      from me m left join rivals r on true
      where m.status = 'won' and not m.flagged
      group by m.time_ms, m.n_guesses),
    'top_state', case
      when p_date < (now() at time zone 'Asia/Kolkata')::date or exists (select 1 from me)
      then (select t.id from top t) end
  );
$$;

revoke all on function public.get_daily_stats(date) from public;
grant execute on function public.get_daily_stats(date) to anon, authenticated;
