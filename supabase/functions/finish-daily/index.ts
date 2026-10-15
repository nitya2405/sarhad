// finish-daily Edge Function (Deno). Verifies the caller, replays the guesses with the shared engine,
// and writes the result through finish_daily_commit (service_role only). Retries are safe: an
// attempt that is already finished returns its stored result unchanged.
import { createClient } from 'npm:@supabase/supabase-js@2';
import gamedata from '../_shared/gamedata.json' with { type: 'json' };
import type { Adjacency, Region } from '../_shared/engine/index.ts';
import { decideFinish, parseBody, storedResponse } from './handler.ts';
import type { AttemptRow, GameData, ScheduleRow } from './handler.ts';

const regions = gamedata.regions as Region[];
const DATA: GameData = {
  adj: gamedata.adjacency as Adjacency,
  knownIds: new Set(regions.map((r) => r.id)),
  playableIds: new Set(regions.filter((r) => r.playable).map((r) => r.id)),
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!jwt) return json({ error: 'unauthorized' }, 401);
  const { data: auth, error: authErr } = await admin.auth.getUser(jwt);
  if (authErr || !auth.user) return json({ error: 'unauthorized' }, 401);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json({ error: 'bad_body' }, 400);
  }
  const body = parseBody(raw);
  if (typeof body === 'string') return json({ error: body }, 400);

  const { data: attempt, error: aErr } = await admin
    .from('daily_attempts')
    .select('id, player_id, ist_date, puzzle_id, started_at, status, guesses, time_ms, points')
    .eq('id', body.attemptId)
    .maybeSingle<AttemptRow>();
  if (aErr) return json({ error: 'db_error' }, 500);

  let schedule: ScheduleRow | null = null;
  if (attempt) {
    const { data, error } = await admin
      .from('daily_schedule')
      .select('puzzle_id, start_id, end_id, k')
      .eq('ist_date', attempt.ist_date)
      .maybeSingle<ScheduleRow>();
    if (error) return json({ error: 'db_error' }, 500);
    schedule = data;
  }

  const decision = decideFinish({ userId: auth.user.id, body, attempt, schedule, nowMs: Date.now(), data: DATA });
  if (decision.kind === 'error') return json({ error: decision.error }, decision.http);
  if (decision.kind === 'stored') return json(decision.response);

  const { data: row, error: cErr } = await admin
    .rpc('finish_daily_commit', {
      p_attempt_id: body.attemptId,
      p_player_id: auth.user.id,
      p_guesses: decision.guesses,
      p_status: decision.status,
      p_time_ms: decision.timeMs,
      p_points: decision.points,
    })
    .single<AttemptRow>();
  if (cErr || !row) return json({ error: 'commit_failed' }, 500);
  // Returns what is stored — if a concurrent call finished first, that result wins.
  return json(storedResponse(row));
});
