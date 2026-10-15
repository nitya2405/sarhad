# Sarhad — Technical Design v2

Oct 15, 2026 · @nitya

v2 folds in the external review and your decisions of 15 Oct: a continuous time-based score, a fixed guess cap, a forgiving streak, hand-verified borders, and a leaner 48-hour plan. It replaces the earlier build plan wherever they differ.

## Locked decisions

Any legal land route wins; the fastest finish earns the most points; the shortest route is only revealed after the game ends.

1. **Win condition.** Let S = {start, end} ∪ accepted guesses. The player wins when start and end are in the same connected component of the border graph restricted to S. Guess order never matters; no canonical route exists. Example: Gujarat → Kerala is won by Maharashtra + Karnataka, *or* Rajasthan + Madhya Pradesh + Maharashtra + Karnataka. 'Rajasthan, Delhi, UP' alone does not link (Delhi touches only Haryana and UP), so Haryana is needed.
2. **Colouring (separate from winning).** `linkedSet(start, end, guesses, adjacency)` returns every guess in the component of start or of end. Those are coloured; other guesses are grey and turn coloured when a later guess connects them. Colour means 'connected to your route', never 'on the shortest route'.
3. **Regions.** Endpoints: the 28 states. Land UTs (Delhi, Chandigarh, Jammu & Kashmir, Ladakh, Dadra & Nagar Haveli and Daman & Diu) are legal stepping stones **only if each of their borders is verified**; separate pieces of one UT never connect to each other. Not playable, no guess spent: Andaman & Nicobar, Lakshadweep, Puducherry.
4. **Graph + BFS.** About 75 hand-verified edges over 33 playable regions, committed as a versioned JSON. A build-time generator runs BFS for every state pair and keeps those with 2 ≤ k ≤ 6 regions in between, storing the distance, k and one shortest route.
5. **Daily selection.** Asia/Kolkata only (UTC+5:30, no daylight saving). The generator runs offline once and commits `daily.json` (IST date → puzzle), starting 2026-10-15; it is append-only after the first deploy and past dates are never edited. **Server builds never ship the schedule:** the daily pair comes only from `start_daily()` when Start is pressed, so future dailies cannot be read from the bundle; a build check fails if a server build contains any date after today. The bundled `daily.json` is used only by builds without a server (dev/offline fallback). Offline with a server configured, Daily shows 'Needs a connection to start'; Practice still works. An attempt keeps its puzzle id from Start to finish, across refreshes and midnight.
6. **Guess cap.** A fixed **20 guesses on every puzzle, shown as 'Guess 3 of 20**'. A cap that changes with k would look arbitrary to players and leak the route length. 20 is deliberately generous for now; tune it after playtests. Time already punishes guessing every state; the cap only makes a loss possible.
7. **Score.** Time t runs from Start to the winning guess. With par = 20 s + 10 s × k: P = round(100 × (k + 1) × par / (par + t)). Faster is always worth more. No separate penalty for extra guesses — they already cost time. Loss or give-up = 0. Practice is unscored in v1.
8. **Leaderboard.** Ranks today's winners by exact time in ms, then fewer guesses, then earlier finish. Before the server exists: 'Your best times' on this phone, never a fake global board.
9. **Streak.** +1 for each IST date with a finished daily — win, loss or give-up all count; only a missed day resets it. Best streak and total wins are kept for good. (Counting give-ups too removes any reason to type junk just to reach the cap.)
10. **Input.** Exact names and aliases accepted at once. A fuzzy match is shown as one highlighted chip; Enter accepts it. Unknown, ambiguous, duplicate, endpoint or unplayable input gives a message and spends no guess. Voice (later) only fills the box; it never submits.
11. **Architecture.** Phase 1: static React + Vite site, all logic on the phone, localStorage. Phase 2: Supabase table + two server functions for official time, one daily per player, and the leaderboard.

## Product spec

Sarhad is a one-minute daily puzzle: connect two Indian states by naming the regions between them, as fast as you can.

- **Daily:** the same pair for everyone each IST day; one scored attempt.
- **Practice:** random valid pair, unlimited, unscored in v1.
- **Reward (v1):** points on the daily, a win streak, and (phase 2) today's leaderboard.

### Game screen (phone, 360 px first)

1. **Header:** 'Gujarat → Kerala' in the endpoint colour, timer (runs on the phone's monotonic clock, so changing the device time cannot move it), 'Guess 3 of 20'. One line under it: 'Name the states in between, in any order.'
2. **Map (\~55% of height):** India with official boundaries, every region an unlabelled outline. Only the two endpoints are filled and labelled at the start. Each accepted guess gets its label and a fill: endpoint colour when connected to start or end, grey when not yet connected (turns coloured later if it joins). Small regions (Delhi, Chandigarh, Goa, Tripura, DNH & DD) get a larger invisible hit area and a dot marker when guessed.
3. **Input (Contexto-style, pinned above the keyboard):** one text box + Enter. No suggestions while the input could still be several regions; one completion chip once it nearly names exactly one region (a complete word of its name, or ≥ 75% of its letters). A misspelling submitted with Enter gets one 'Did you mean …?' chip that the next Enter accepts. Visual design: `docs/DESIGN-SYSTEM.md`.
4. **Message line:** one short line for every rejected input — 'Already guessed', 'Not a state name', 'That's your start/end', 'No land border — not playable', 'Did you mean…'. None of these spends a guess.
5. **Guess list (newest first):** name + ● connected or ○ not yet connected. This list alone is enough to play, so the game still works if the map fails to load or for screen readers.
6. **Give up** link, small, bottom.

### Result screen

Time, guesses, points; your connected route on the map. If your route is as short as possible: 'You found a shortest route!' Otherwise: 'One shortest route needs N states' with that route animated — always labelled 'one', never 'the correct route'. Streak, best streak, wins. Countdown to the next daily; Practice button.

## Game state machine

A game never moves backwards: once Won or Lost it is frozen, and a refresh always lands on the same state with the same puzzle and start time.

&#91;embedded content: Game states · 7 states\]

| From | Event | Guard | To | Effect |
| --- | --- | --- | --- | --- |
| Loading | open | today's daily already finished | Done today | show stored result |
| Loading | open | attempt in progress | Playing | restore guesses; timer continues from stored start |
| Loading | open | no attempt | Ready | show endpoints hidden until Start |
| Ready | Start | — | Playing | store puzzle id and startedAt |
| Playing | submit | unknown, ambiguous, duplicate, endpoint, or not playable | Playing | message; no guess spent |
| Playing | submit | new playable region; A–B still not linked; guesses < 20 | Playing | add guess, recolour, persist |
| Playing | submit | new region links A to B | Won | t = finish − start; points |
| Playing | submit | 20th guess, still not linked | Lost | 0 points |
| Playing | Give up | — | Lost | 0 points |
| Won / Lost | — | — | Result saved | persist; streak +1 for a daily; phase 2 sends to server and retries until confirmed |
| any | IST midnight | — | (no change) | the running attempt keeps its puzzle; Home shows the new daily |

The endpoints stay hidden on Ready so nobody can study the pair before the clock starts.

## Schema

Regions, adjacency and puzzles are static files shipped with the app; only attempts and scores need a database, and only from phase 2.

### Static data (committed JSON, generated and validated by `scripts/build-data.ts`)

```typescript
type RegionId = string;            // 2 uppercase letters, e.g. 'MH', 'DL'

interface Region {
  id: RegionId;
  kind: 'state' | 'ut';
  playable: boolean;               // false: PY, AN, LD
  name: { en: string; hi: string };
  aliases: string[];               // stored pre-normalised
}

type Adjacency = Record<RegionId, RegionId[]>;   // symmetric, playable only

interface Puzzle {
  id: string;                      // 'GJ-KL'
  start: RegionId; end: RegionId;  // kind === 'state'
  k: number;                       // regions between on a shortest route, 2..6
  shortest: RegionId[];            // one shortest route, start..end, for the reveal
}

interface DailySchedule {
  version: number;                 // bump only by appending dates
  entries: { date: string; puzzleId: string }[];   // 'YYYY-MM-DD' in IST
}
```

### Phase 1: on the phone (localStorage key `sarhad:v1`)

```typescript
interface Attempt {
  attemptId: string;               // uuid
  mode: 'daily' | 'practice';
  date?: string;                   // IST date, daily only
  puzzleId: string;
  startedAt: number;               // epoch ms
  guesses: { id: RegionId; at: number }[];
  status: 'playing' | 'won' | 'lost';
  finishedAt?: number;
  points?: number;
}

interface LocalPlayer {
  playerId: string;                // uuid, made on first open
  streak: number; best: number; lastWinDate?: string;
  totalPoints: number;
  attempts: Attempt[];             // dailies kept 400 days (streaks); practice: last 30
}
```

### Phase 2: Supabase

```sql
create table players (
  id uuid primary key,
  display_name text not null check (char_length(display_name) between 3 and 20),
  created_at timestamptz not null default now()
);

create table daily_attempts (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id),
  ist_date date not null,
  puzzle_id text not null,
  started_at timestamptz not null default now(),   -- server clock
  finished_at timestamptz,
  status text not null default 'playing' check (status in ('playing','won','lost')),
  guesses text[] not null default '{}',
  time_ms int, points int,
  unique (player_id, ist_date)                     -- one daily per player per day
);

-- No daily_board view: get_daily_board(date) (security definer) returns the top 50 winners
-- (time_ms, then cardinality(guesses), then finished_at) with display names, plus the caller's
-- rank. It never exposes player ids, guesses or other players' attempt rows.
```

Row-level security is on with no insert or update policies; the player id comes from a silent Supabase anonymous identity (the auth token), never from a uuid the client sends. Two functions do every write (plus `set_display_name` for the leaderboard name):

- `start_daily()` — inserts today's row with the server's `started_at`, or returns the existing row. Two tabs or two calls get the same attempt and the same start.
- `finish_daily(attempt_id, guesses)` — one transaction. Rejects if the attempt is not the caller's, or the guess list is longer than 20, has unknown ids, duplicates, endpoints or unplayable regions. Replays the guesses on the server copy of the graph, decides won or lost, computes time and points, sets status. If the attempt is already finished, it returns the stored result unchanged — this makes retries after a timeout safe without a separate idempotency key, because an attempt can move from playing to finished only once.

A lost or given-up attempt uses up the day. Streak and totals are computed from `daily_attempts`, not stored, so they cannot drift.

**Timing semantics:** the on-screen timer is the phone's; the official time is server finish − server start, which includes network delay (a few seconds on slow data). The explainer states this rather than claiming perfect fairness.

**One engine, two places:** the server check needs the same graph logic as the phone. Simplest route: write it once in TypeScript and run it in a Supabase Edge Function. Both copies are tested against one shared fixture file.

## Adjacency data (draft, unverified)

**The list below** was written from general knowledge, then cross-checked against the map file (note under the list); two borders still need a check on the official political map. v2 changes the method: the graph is **hand-curated and reviewed edge by edge**, not computed from map geometry, because a geometry pipeline with a distance threshold cannot be fully checked in two days. The map is used to display, and as a cross-check.

```json
{
  "AP": ["TG","KA","TN","OD","CG"],
  "AR": ["AS","NL"],
  "AS": ["AR","NL","MN","MZ","TR","ML","WB"],
  "BR": ["UP","JH","WB"],
  "CG": ["MP","MH","TG","AP","OD","JH","UP"],
  "GA": ["MH","KA"],
  "GJ": ["RJ","MP","MH","DD"],
  "HR": ["PB","HP","RJ","UP","DL","CH"],
  "HP": ["JK","LA","PB","HR","UK","UP"],
  "JH": ["BR","UP","CG","OD","WB"],
  "KA": ["GA","MH","TG","AP","TN","KL"],
  "KL": ["KA","TN"],
  "MP": ["RJ","GJ","MH","CG","UP"],
  "MH": ["GJ","MP","CG","TG","KA","GA","DD"],
  "MN": ["NL","AS","MZ"],
  "ML": ["AS"],
  "MZ": ["AS","MN","TR"],
  "NL": ["AR","AS","MN"],
  "OD": ["WB","JH","CG","AP"],
  "PB": ["JK","HP","HR","RJ","CH"],
  "RJ": ["PB","HR","UP","MP","GJ"],
  "SK": ["WB"],
  "TN": ["KL","KA","AP"],
  "TG": ["MH","CG","AP","KA"],
  "TR": ["AS","MZ"],
  "UP": ["UK","HP","HR","DL","RJ","MP","CG","JH","BR"],
  "UK": ["HP","UP"],
  "WB": ["SK","AS","BR","JH","OD"],
  "DL": ["HR","UP"],
  "CH": ["PB","HR"],
  "JK": ["LA","HP","PB"],
  "LA": ["JK","HP"],
  "DD": ["GJ","MH"]
}
```

**Map cross-check, 15 Oct (SimpleMaps file):** 63 borders agree with the map. Rulings: HR–UK removed (no contact in the map). AP–CG kept although the map shows no contact, and OD–TG left out although the map shows \~53 km — the file appears to draw the line before the 2014 transfer of seven Khammam mandals to Andhra Pradesh; confirm both on the official political map. HP–UP is real but only \~5 km. Puducherry's five pieces touch AP, Kerala and Tamil Nadu separately, so it stays not playable.

`DD` = Dadra & Nagar Haveli and Daman & Diu (the Dadra piece touches both Gujarat and Maharashtra). Not listed, not playable: PY, AN, LD.

### How it gets verified

1. Pick one state/UT map file with India's official boundaries; record source, date and licence in `data/SOURCES.md`. The same file drives the drawn map, so map and graph cannot drift apart.
2. For each of the \~75 edges, confirm against the official political map and note the evidence in `data/ADJACENCY_NOTES.md`. Check the doubtful pairs first: HR–UK, HP–UP, AP–CG, HP–LA, MZ–TR, KA–TG, OD–AP.
3. Land UTs: verify every border of Delhi, Chandigarh, J&K, Ladakh and DNH & DD. Confirm the Dadra & Nagar Haveli piece itself touches both Gujarat and Maharashtra; if not, list only the borders that hold. Any UT border that cannot be verified is left out.
4. Cross-check script: for every edge, the two map shapes must share a boundary; for every pair of shapes that share one, an edge must exist or be listed as a deliberate exclusion. Disagreements print loudly and fail the build until resolved by a person.
5. Invariants (build fails otherwise): symmetric, no self-edges, every id known and drawn on the map, all 33 playable regions connected.
6. Freeze as `adjacency.v1.json`; any later change bumps the version.
7. Only then run the puzzle generator.

The generator also prints any state pair whose shortest route passes through a UT. That is allowed by the rules, but you should know which puzzles rely on it.

## Implementation plan

Playable on a real phone by hour 12; the server only starts once the core is solid. If a block overruns, cut a later feature, never testing.

### Hours 0–4 — rules and engine (gate: engine tests green)

- [x] Map file chosen: SimpleMaps India admin-1 GeoJSON, CC BY 4.0. Ladakh reaches 37.08°N / 80.33°E and J&K 73.4°E, matching India's official depiction (checked 15 Oct)
- [x] Draft borders cross-checked against the map: 63 agree; HR–UK dropped (no contact); AP–CG kept and OD–TG left out (map file predates the 2014 mandal transfer); DD playable via its Dadra piece (checked 15 Oct)
- [x] Build prompt for Claude Code written: parallel tracks, commits only after approval (15 Oct)
- [ ] Confirm AP–CG and OD–TG on the official political map; freeze `adjacency.v1.json`
- [ ] Supabase set up: keys in `.env`, anonymous sign-ins on, CLI linked (you)
- [ ] `engine.ts`: `resolveInput`, `linkedSet`, `isWon`, `shortestDistance`, `score`, `istDate`
- [ ] Generator: puzzles with 2 ≤ k ≤ 6, one shortest route each, `daily.json` for 365 days, no pair repeated within 60 days
- [ ] Vitest for every engine row of the test matrix

### Hours 4–12 — playable game (gate: full daily on a real Android, deployed)

- [ ] Vite + React + TS; deploy to a free static host in the first hour of this block
- [ ] Map SVG from the map file (one path per region id), game screen, result screen
- [ ] Input with chips, message line, guess list, 20-guess cap, give up

### Hours 12–20 — daily loop (gate: refresh and midnight tests pass)

- [ ] localStorage save, resume, one daily per IST date
- [ ] Points, streak, best streak, wins, 'Your best times'
- [ ] Practice mode (unscored)
- [ ] PWA cache; Slow 4G check

### Hours 20–30 — server, only if the above is solid (gate: duplicate and ownership tests pass on the live server)

- [ ] Supabase: table, RLS, anonymous identity, `start_daily`, `finish_daily` (Edge Function, shared engine)
- [ ] Today's India leaderboard; display name after first win
- [ ] If this block fails: ship without it and say so — no fake board

### Hours 30–48 — test, polish, submit

- [ ] Run the whole test matrix on the deployed build, in a private window
- [ ] Clone the repo fresh and follow the README exactly
- [ ] No secrets committed; data sources and licences documented
- [ ] README (setup, architecture, tests) and 2–3 minute explainer that matches what actually works

### Later (named in the explainer, not built)

Voice input, more scripts, share card, state leaderboards, GPS, sign-in accounts, practice points, badges, streak freezes, push reminders, a verified fact per state on the result screen.

## Test matrix

This matrix is the acceptance list: a release ships only when every row passes. Route cases assume the draft adjacency, so re-check them once the edges are verified. Nothing here has been run yet.

| ID | Area | Situation | Expected |
| --- | --- | --- | --- |
| R1 | Route | GJ → KL, guesses MH, KA | Won, 2 guesses, 'shortest route' message |
| R2 | Longer route | GJ → KL, guesses RJ, MP, MH, KA | Won, 4 guesses, shows one shortest route |
| R3 | Order | GJ → KL, guesses KA then MH | Won on MH |
| R4 | Not linked | GJ → KL, guesses RJ, DL, UK | Playing; RJ coloured; DL, UK grey |
| R5 | Late link | R4, then UP | DL and UK turn coloured; still Playing |
| R6 | UT step | GJ → KL, guess DD | accepted, guess spent, coloured, not required |
| R7 | Cap | 20 guesses, none linking | Lost on the 20th |
| R8 | Reveal | any finish | shown route re-validates edge by edge; labelled 'one shortest route' |
| R9 | Equal-length routes | RJ → OD via MP+CG, UP+CG, or UP+JH | each one Won with 'shortest route' message |
| R10 | Cycles / extras | route plus extra connected states | still Won; colours correct |
| V1 | Generator | every puzzle | ends are distinct states; 2 ≤ k ≤ 6; BFS distance = stored |
| V2 | Graph | adjacency file | symmetric, no self-edges, ids known and drawn, connected |
| V3 | Graph | asymmetric or unknown id injected | build fails with a clear message |
| V4 | Schedule | daily.json | every date one valid puzzle; no pair within 60 days |
| I1 | Invalid input | '', spaces, '😀', 200 characters | message, no guess spent, trimmed to 40 |
| I2 | Invalid input | 'Paris', 'xyz' | 'Not a state name', no guess spent |
| I3 | Not playable | 'Puducherry', 'Andaman', 'Lakshadweep' | 'No land border — not playable', no guess spent |
| I4 | Endpoint | start state typed | 'That's your start', no guess spent |
| I5 | Aliases | 'mp', 'M.P.', 'Orissa', 'Uttaranchal', 'मध्य प्रदेश' | MP, MP, OD, UK, MP accepted at once |
| I6 | Typos | 'Maharastra', 'Chattisgarh', 'Telengana' + Enter | one 'Did you mean …?' chip; the next Enter accepts; never auto-accepted |
| I7 | No early reveal | typing 'a', 'ar', 'arun', 'kera', 'mani'; then 'arunachal', 'keral', 'uttar', 'west' | nothing shown until the input nearly names exactly one region (a complete word of its name, or ≥ 75% of a name's letters as a prefix): AR, KL, UP (not UK), WB chips; exact names/aliases ('mp', 'up', 'j&k', 'orissa') accepted on Enter with no chip; abbreviations exact only; nothing auto-accepted |
| D1 | Repeat | MH twice; 'Maharashtra' then 'mh' | 'Already guessed', no guess spent |
| F1 | Refresh | mid-game | same puzzle, guesses, start time |
| F2 | Refresh | after finishing | Done today, stored result, no second score |
| F3 | Two tabs | finish in one, guess in the other | other tab shows finished on next action |
| F4 | Old or broken save | corrupt or v0 localStorage | discarded safely; app loads; no crash |
| F5 | Stale cache | old service worker, new day | today's puzzle still correct (schedule covers a year) |
| F6 | Map fails | SVG missing | game playable from the guess list |
| T1 | Midnight | start 23:59:30 IST, win 00:00:20 | counts for the start date |
| T2 | Abroad | device in New York time | IST date used |
| T3 | Device clock | changed mid-game | timer unaffected (monotonic); phase 1 date may be wrong — known limit |
| S1 | Score | k = 4, t = 50 s | 273 |
| S2 | Score | k = 4, t = 600 s | 45 |
| S3 | Score | k = 4 at 20 / 40 / 60 s | 375 > 300 > 250 |
| S4 | Score | loss or give up | 0 |
| S5 | Ties | equal ms | fewer guesses, then earlier finish |
| K1 | Streak | finished 14, 15, 16 Oct | 3 |
| K2 | Streak | finished 14, missed 15, finished 16 | 1; best stays 1+ |
| K3 | Streak | won 14, lost 15, won 16 | 3; wins 2 |
| K4 | Streak | gave up on 15 | streak continues |
| K5 | Streak | practice only on a day | that day counts as missed |
| P1 | Server | start\_daily twice / two tabs | same row, same started\_at |
| P2 | Server | finish twice, or retry after timeout | same stored result, one row |
| P3 | Server | finish another player's attempt | rejected |
| P4 | Server | guesses with unknown ids, duplicates, 21+ items | rejected |
| P5 | Server | claims a win with an unlinked set | recorded as not won |
| M1 | Mobile | 320–360 px, 200% font, keyboard open | input and last guess visible; no sideways scroll |
| M2 | Mobile | keyboard-only and screen reader | every action reachable; guess list read out |
| M3 | Mobile | Slow 4G cold load | playable in under 5 s (target, unmeasured) |

## Decision log and limits

Every open question from v1 is now decided; what remains are tuning values to check in playtests and limits to state honestly in the explainer.

| Decision | Chosen | Rejected | Why |
| --- | --- | --- | --- |
| Win rule | Any connected route | One stored route | Several routes are often equally short; rejecting a correct one is unfair |
| Score | 100(k+1)·par/(par+t) | Clamped par/t (v1) | v1 gave full points to everyone under par |
| Guess penalty | None; guesses break ties | −5 per wrong guess | Time already costs; 'wrong' is undefined when any route wins |
| Guess cap | Fixed 20 (for now) | k + 6 | A changing cap looks arbitrary and hints at route length |
| Streak | Any finished daily | Wins only | Rewards the daily habit; stops junk-guessing to reach the cap |
| Practice | Unscored | 20% points, capped | Simpler; nothing to farm |
| Leaderboard before server | Your best times | Local 'leaderboard' | A fake board is worse than none |
| Map labels | Endpoints + guesses only | All labels; tap to reveal | Labels would turn the puzzle into reading the map |
| Fuzzy input | One chip, Enter accepts | Silent auto-accept | Confirmation at no time cost |
| Adjacency | Hand-verified edges | Geometry threshold | Checkable in two days |
| Retries | Finish is one-way per attempt | Idempotency key | Same safety, less to build |

### Tuning values (check with 3–5 playtesters)

- Par 20 s + 10 s × k: should put a typical solve near the middle of the point range.
- Cap 20: losses should be rare but possible; lower it if nobody ever gets close.
- Fuzzy thresholds: no wrong state ever accepted in the typo tests.

### Limits to state in the explainer

- Phase 1 scores live on the phone and can be edited; they are personal only.
- Anonymous identities stop impersonation, not multiple accounts. Real-money payouts would need verified accounts.
- Official time includes network delay.
- The border graph is public, so a bot could solve instantly; very fast finishes are flagged, threshold untested.
- Adjacency is hand-verified against one map source; boundary questions are resolved by that source.

### Deliverables

Live link, repository with a README (setup, architecture, how to run tests), and a 2–3 minute explainer. The brief also asks applicants to say where AI tools were used; that line stays on this list because it is part of the required submission.
