// Graph invariants (DESIGN "How it gets verified" step 5) via the engine's shared validateGraph,
// plus: alias uniqueness across regions after normalisation. Exit 1 on any problem.
import { existsSync } from 'node:fs';
import { validateGraph } from '../supabase/functions/_shared/engine/graph.ts';
import { buildAliasIndex } from '../supabase/functions/_shared/engine/resolve.ts';
import { fail, loadAdjacency, loadSourceRegions, p, readJson } from './lib/common.ts';

const regions = loadSourceRegions();
const adj = loadAdjacency();
const mapFile = p('src/data/map.json');
if (!existsSync(mapFile)) fail('src/data/map.json missing — run data:map first');
const map = readJson<{ regions: Record<string, unknown> }>(mapFile);

const playableIds = regions.filter((r) => r.playable).map((r) => r.id);
const errors = validateGraph(adj, {
  knownIds: regions.map((r) => r.id),
  playableIds,
  drawnIds: Object.keys(map.regions),
});

try {
  buildAliasIndex(regions);
} catch (e) {
  errors.push((e as Error).message);
}
if (playableIds.length !== 33) errors.push(`Expected 33 playable regions, found ${playableIds.length}`);

if (errors.length) fail(`Graph invalid:\n  - ${errors.join('\n  - ')}`);
const edges = Object.values(adj).reduce((n, l) => n + l.length, 0) / 2;
console.log(`✓ graph valid: ${Object.keys(adj).length} regions, ${edges} edges, symmetric, connected; aliases unique`);
