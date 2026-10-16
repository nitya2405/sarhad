-- Let the publishable key alone (role anon) read the daily board.
-- The board is already readable by anyone who signs in anonymously, so this exposes nothing new:
-- display names, times and guess counts only; no player ids, no guesses, no schedule.
-- Used by the keepalive job (.github/workflows/keepalive.yml) so the free project doesn't pause.
-- For anon callers auth.uid() is null, so is_me is null and my_rank is null.
grant execute on function public.get_daily_board(date) to anon;
