-- Server tests P1–P6 (DESIGN test matrix). Run: npx supabase test db
-- P5 ("claims a win with an unlinked set") is decided by the Edge Function replay
-- (supabase/functions/finish-daily/handler.test.ts); here we check the client cannot write a result at all.
begin;
select plan(29);

-- ---------------------------------------------------------------- fixtures (as postgres)
insert into auth.users (id, aud, role, is_anonymous) values
  ('11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', true),
  ('22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', true);

insert into public.daily_schedule (ist_date, puzzle_id, start_id, end_id, k)
values ((now() at time zone 'Asia/Kolkata')::date, 'GJ-KL', 'GJ', 'KL', 2)
on conflict (ist_date) do update set puzzle_id = 'GJ-KL', start_id = 'GJ', end_id = 'KL', k = 2;

-- ---------------------------------------------------------------- P1: start_daily is idempotent
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select results_eq(
  'select attempt_id, started_at, puzzle_id, start_id, end_id, k, status from public.start_daily()',
  'select attempt_id, started_at, puzzle_id, start_id, end_id, k, status from public.start_daily()',
  'P1: start_daily twice returns the same attempt and started_at');
select is((select count(*) from public.daily_attempts), 1::bigint, 'P1: one row for the player');
select is((select puzzle_id from public.start_daily()), 'GJ-KL', 'P1: attempt carries today''s puzzle');
select is((select display_name from public.players), 'Player 1111', 'P1: player row created with a default name');

-- ---------------------------------------------------------------- P6: no direct writes for authenticated (anon sign-in) users
select throws_ok($$insert into public.players (id, display_name) values ('11111111-1111-1111-1111-111111111111', 'hacker')$$,
  '42501', null, 'P6: insert players rejected');
select throws_ok($$update public.players set display_name = 'hacker'$$, '42501', null, 'P6: update players rejected');
select throws_ok($$delete from public.players$$, '42501', null, 'P6: delete players rejected');
select throws_ok($$insert into public.daily_attempts (player_id, ist_date, puzzle_id) values ('11111111-1111-1111-1111-111111111111', current_date, 'GJ-KL')$$,
  '42501', null, 'P6: insert daily_attempts rejected');
select throws_ok($$update public.daily_attempts set status = 'won', points = 9999, finished_at = now()$$,
  '42501', null, 'P6/P5: client cannot mark its own attempt won');
select throws_ok($$delete from public.daily_attempts$$, '42501', null, 'P6: delete daily_attempts rejected');
select throws_ok($$insert into public.daily_schedule values ('2099-01-01', 'GJ-KL', 'GJ', 'KL', 2)$$, '42501', null, 'P6: insert daily_schedule rejected');
select throws_ok($$update public.daily_schedule set k = 6$$, '42501', null, 'P6: update daily_schedule rejected');
select throws_ok($$delete from public.daily_schedule$$, '42501', null, 'P6: delete daily_schedule rejected');
select throws_ok($$select * from public.finish_daily_commit(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '{MH,KA}', 'won', 1, 999)$$,
  '42501', null, 'P6/P5: authenticated cannot call finish_daily_commit');
select lives_ok($$select public.get_daily_board((now() at time zone 'Asia/Kolkata')::date)$$, 'P6: get_daily_board callable');
select lives_ok($$select public.set_display_name('  Nitya  ')$$, 'P6: set_display_name callable');
select is((select display_name || ':' || is_default_name from public.players), 'Nitya:false', 'set_display_name trims and clears default flag');
select throws_ok($$select public.set_display_name('ab')$$, '22023', null, 'set_display_name rejects < 3 chars');

-- ---------------------------------------------------------------- P6: other players' rows invisible
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is((select count(*) from public.daily_attempts), 0::bigint, 'P6: player 2 cannot see player 1''s attempt');
select is((select count(*) from public.players), 0::bigint, 'P6: player 2 cannot see player 1''s player row');
select lives_ok('select public.start_daily()', 'player 2 starts a daily');

-- anon (no sign-in) cannot call RPCs
reset role;
set local role anon;
select throws_ok('select public.start_daily()', '42501', null, 'P6: anon role cannot call start_daily');

-- ---------------------------------------------------------------- service_role: finish_daily_commit
reset role;
set local role service_role;

-- P3
select throws_ok(
  $$select * from public.finish_daily_commit((select id from public.daily_attempts where player_id = '11111111-1111-1111-1111-111111111111'),
    '22222222-2222-2222-2222-222222222222', '{MH,KA}', 'won', 5000, 150)$$,
  '42501', 'not_owner', 'P3: finishing another player''s attempt is rejected');

-- P4
select throws_ok(
  $$select * from public.finish_daily_commit((select id from public.daily_attempts where player_id = '22222222-2222-2222-2222-222222222222'),
    '22222222-2222-2222-2222-222222222222', '{XX}', 'lost', null, 0)$$,
  '22023', 'unknown', 'P4: unknown id rejected');
select throws_ok(
  $$select * from public.finish_daily_commit((select id from public.daily_attempts where player_id = '22222222-2222-2222-2222-222222222222'),
    '22222222-2222-2222-2222-222222222222', '{MH,MH}', 'lost', null, 0)$$,
  '22023', 'duplicate', 'P4: duplicate rejected');
select throws_ok(
  $$select * from public.finish_daily_commit((select id from public.daily_attempts where player_id = '22222222-2222-2222-2222-222222222222'),
    '22222222-2222-2222-2222-222222222222',
    '{AP,AR,AS,BR,CG,GA,HR,HP,JH,KA,MP,MH,MN,ML,MZ,NL,OD,PB,RJ,SK,TN}', 'lost', null, 0)$$,
  '22023', 'too_many', 'P4: 21 guesses rejected');

-- P2: finish twice → same stored result, one row
select results_eq(
  $$select status, time_ms, points from public.finish_daily_commit((select id from public.daily_attempts where player_id = '11111111-1111-1111-1111-111111111111'),
    '11111111-1111-1111-1111-111111111111', '{MH,KA}', 'won', 5000, 150)$$,
  $$values ('won'::text, 5000, 150)$$,
  'P2: first finish stores the result');
select results_eq(
  $$select status, time_ms, points, guesses from public.finish_daily_commit((select id from public.daily_attempts where player_id = '11111111-1111-1111-1111-111111111111'),
    '11111111-1111-1111-1111-111111111111', '{RJ}', 'lost', null, 0)$$,
  $$values ('won'::text, 5000, 150, '{MH,KA}'::text[])$$,
  'P2: retry returns the stored result unchanged');
select is((select count(*) from public.daily_attempts where player_id = '11111111-1111-1111-1111-111111111111'), 1::bigint, 'P2: still one row');

select * from finish();
rollback;
