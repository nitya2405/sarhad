-- Fast-finish guard: flagged at the boundary (< 1500 + 1000 × guesses), kept off the board, own row
-- still visible as my_review. Run: npx supabase test db
begin;
select plan(12);

insert into auth.users (id, aud, role, is_anonymous) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'authenticated', 'authenticated', true),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'authenticated', 'authenticated', true),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'authenticated', 'authenticated', true);

insert into public.daily_schedule (ist_date, puzzle_id, start_id, end_id, k)
values ((now() at time zone 'Asia/Kolkata')::date, 'GJ-KL', 'GJ', 'KL', 2)
on conflict (ist_date) do update set puzzle_id = 'GJ-KL', start_id = 'GJ', end_id = 'KL', k = 2;

-- each player starts today's daily
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
select public.start_daily();
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}', true);
select public.start_daily();
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000003","role":"authenticated"}', true);
select public.start_daily();
reset role;

-- two guesses → threshold 1500 + 2000 = 3500 ms
set local role service_role;
select is((select flagged from public.finish_daily_commit(
  (select id from public.daily_attempts where player_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  'aaaaaaaa-0000-0000-0000-000000000001', '{MH,KA}', 'won', 3499, 300)), true, 'win at 3499 ms with 2 guesses is flagged');
select is((select flagged from public.finish_daily_commit(
  (select id from public.daily_attempts where player_id = 'aaaaaaaa-0000-0000-0000-000000000002'),
  'aaaaaaaa-0000-0000-0000-000000000002', '{MH,KA}', 'won', 3500, 299)), false, 'win at exactly 3500 ms is not flagged');
select is((select flagged from public.finish_daily_commit(
  (select id from public.daily_attempts where player_id = 'aaaaaaaa-0000-0000-0000-000000000003'),
  'aaaaaaaa-0000-0000-0000-000000000003', '{MH}', 'lost', null, 0)), false, 'a loss is never flagged');

-- the flagged result is still stored in full
select results_eq(
  $$select status, time_ms, points from public.daily_attempts where player_id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  $$values ('won'::text, 3499, 300)$$,
  'flagged win keeps status, time and points');
-- and a retry returns it unchanged, flag included
select is((select flagged from public.finish_daily_commit(
  (select id from public.daily_attempts where player_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  'aaaaaaaa-0000-0000-0000-000000000001', '{MH,KA}', 'won', 9999, 1)), true, 'retry returns the stored flagged row');
reset role;

-- the board, seen by player 2 (unflagged winner)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}', true);
select is(jsonb_array_length(public.get_daily_board((now() at time zone 'Asia/Kolkata')::date)->'rows'), 1, 'board lists only the unflagged win');
select is((public.get_daily_board((now() at time zone 'Asia/Kolkata')::date)->'rows'->0->>'time_ms')::int, 3500, 'the listed win is the 3500 ms one');
select is((public.get_daily_board((now() at time zone 'Asia/Kolkata')::date)->>'my_rank')::int, 1, 'unflagged winner ranks 1');
select is(public.get_daily_board((now() at time zone 'Asia/Kolkata')::date)->'my_review', 'null'::jsonb, 'no review entry for an unflagged player');

-- the board, seen by player 1 (flagged)
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is(public.get_daily_board((now() at time zone 'Asia/Kolkata')::date)->'my_rank', 'null'::jsonb, 'flagged player has no rank');
select is((public.get_daily_board((now() at time zone 'Asia/Kolkata')::date)->'my_review'->>'time_ms')::int, 3499, 'flagged player sees their own row as my_review');
select ok(not exists (
  select 1 from jsonb_array_elements(public.get_daily_board((now() at time zone 'Asia/Kolkata')::date)->'rows') r where (r->>'is_me')::boolean),
  'flagged player is not in the listed rows');

select * from finish();
rollback;
