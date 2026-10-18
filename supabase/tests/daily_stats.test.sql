-- get_daily_stats: aggregates only; flagged wins out of the median and the comparison; the
-- most-guessed state is hidden from anyone who hasn't finished today. Run: npx supabase test db
begin;
select plan(16);

insert into auth.users (id, aud, role, is_anonymous) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'authenticated', 'authenticated', true),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'authenticated', 'authenticated', true),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'authenticated', 'authenticated', true),
  ('bbbbbbbb-0000-0000-0000-000000000004', 'authenticated', 'authenticated', true),
  ('bbbbbbbb-0000-0000-0000-000000000005', 'authenticated', 'authenticated', true),
  ('bbbbbbbb-0000-0000-0000-000000000006', 'authenticated', 'authenticated', true);

insert into public.daily_schedule (ist_date, puzzle_id, start_id, end_id, k)
values ((now() at time zone 'Asia/Kolkata')::date, 'GJ-KL', 'GJ', 'KL', 2)
on conflict (ist_date) do update set puzzle_id = 'GJ-KL', start_id = 'GJ', end_id = 'KL', k = 2;
-- start from an empty day (local play may have left rows; rolled back at the end)
delete from public.daily_attempts where ist_date = (now() at time zone 'Asia/Kolkata')::date;

-- the function is callable, and empty before anyone has played
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is(public.get_daily_stats((now() at time zone 'Asia/Kolkata')::date),
  '{"players":0,"median_ms":null,"faster_than_pct":null,"top_state":null}'::jsonb, 'no players yet: zeros and nulls');

-- players 1–6 start; 6 never finishes
select public.start_daily();
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true);
select public.start_daily();
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000003","role":"authenticated"}', true);
select public.start_daily();
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000004","role":"authenticated"}', true);
select public.start_daily();
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000005","role":"authenticated"}', true);
select public.start_daily();
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000006","role":"authenticated"}', true);
select public.start_daily();
reset role;

-- 1: won 10 s · 2: won 20 s · 3: won 30 s, 3 guesses · 4: lost · 5: flagged win (1 s)
set local role service_role;
select public.finish_daily_commit((select id from public.daily_attempts where player_id = 'bbbbbbbb-0000-0000-0000-000000000001'),
  'bbbbbbbb-0000-0000-0000-000000000001', '{MH,KA}', 'won', 10000, 400);
select public.finish_daily_commit((select id from public.daily_attempts where player_id = 'bbbbbbbb-0000-0000-0000-000000000002'),
  'bbbbbbbb-0000-0000-0000-000000000002', '{MH,KA}', 'won', 20000, 300);
select public.finish_daily_commit((select id from public.daily_attempts where player_id = 'bbbbbbbb-0000-0000-0000-000000000003'),
  'bbbbbbbb-0000-0000-0000-000000000003', '{MP,MH,KA}', 'won', 30000, 200);
select public.finish_daily_commit((select id from public.daily_attempts where player_id = 'bbbbbbbb-0000-0000-0000-000000000004'),
  'bbbbbbbb-0000-0000-0000-000000000004', '{RJ}', 'lost', null, 0);
select public.finish_daily_commit((select id from public.daily_attempts where player_id = 'bbbbbbbb-0000-0000-0000-000000000005'),
  'bbbbbbbb-0000-0000-0000-000000000005', '{MH,KA}', 'won', 1000, 500);
reset role;

set local role authenticated;
-- seen by player 2 (middle winner)
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true);
select is((public.get_daily_stats((now() at time zone 'Asia/Kolkata')::date)->>'players')::int, 5, 'players = finished attempts (the unfinished one is not counted)');
select is((public.get_daily_stats((now() at time zone 'Asia/Kolkata')::date)->>'median_ms')::int, 20000, 'median of the unflagged wins (10, 20, 30 s); the flagged 1 s win is left out');
-- rivals (unflagged, not me): 1 faster, 3 slower, 4 lost → beat 2 of 3
select is((public.get_daily_stats((now() at time zone 'Asia/Kolkata')::date)->>'faster_than_pct')::int, 67, 'faster than 2 of 3 rivals = 67%');
-- MH ×4, KA ×4 (tie → alphabetical), MP ×1, RJ ×1
select is(public.get_daily_stats((now() at time zone 'Asia/Kolkata')::date)->>'top_state', 'KA', 'most-guessed state, ties broken by id');
select is((select array_agg(k order by k) from jsonb_object_keys(public.get_daily_stats((now() at time zone 'Asia/Kolkata')::date)) k),
  array['faster_than_pct', 'median_ms', 'players', 'top_state'], 'only the four aggregates come back: no ids, no guesses');

-- player 1 (fastest unflagged) beat everyone; player 3 beat only the loser
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is((public.get_daily_stats((now() at time zone 'Asia/Kolkata')::date)->>'faster_than_pct')::int, 100, 'fastest winner: 100%');
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000003","role":"authenticated"}', true);
select is((public.get_daily_stats((now() at time zone 'Asia/Kolkata')::date)->>'faster_than_pct')::int, 33, 'slowest winner beat the loser only: 33%');

-- a loser and a flagged winner get no percentage, but do see the top state (they finished)
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000004","role":"authenticated"}', true);
select is(public.get_daily_stats((now() at time zone 'Asia/Kolkata')::date)->'faster_than_pct', 'null'::jsonb, 'a loss has no percentage');
select is(public.get_daily_stats((now() at time zone 'Asia/Kolkata')::date)->>'top_state', 'KA', 'a finished loser sees the top state');
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000005","role":"authenticated"}', true);
select is(public.get_daily_stats((now() at time zone 'Asia/Kolkata')::date)->'faster_than_pct', 'null'::jsonb, 'a flagged win has no percentage');

-- not finished yet (player 6 is still playing): no spoiler
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000006","role":"authenticated"}', true);
select is(public.get_daily_stats((now() at time zone 'Asia/Kolkata')::date)->'top_state', 'null'::jsonb, 'still playing: top state hidden');
select is((public.get_daily_stats((now() at time zone 'Asia/Kolkata')::date)->>'players')::int, 5, 'still playing: the counts are shown');
select is(public.get_daily_stats((now() at time zone 'Asia/Kolkata')::date)->'faster_than_pct', 'null'::jsonb, 'still playing: no percentage');
reset role;

-- anon (the publishable key alone): counts, no top state today
set local role anon;
select is((public.get_daily_stats((now() at time zone 'Asia/Kolkata')::date)->>'players')::int, 5, 'anon sees the player count');
select is(public.get_daily_stats((now() at time zone 'Asia/Kolkata')::date)->'top_state', 'null'::jsonb, 'anon: top state hidden today');
reset role;

select * from finish();
rollback;
