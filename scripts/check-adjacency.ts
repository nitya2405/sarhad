// Cross-check: recompute which regions touch in the raw map geometry (within ~1 km) and compare
// with the hand-curated data/adjacency.v1.json. The graph is the source of truth; this script only
// flags disagreements. Deliberate differences are listed below; anything else fails the build.
import { readFileSync } from 'node:fs';
import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import { RAW_GEOJSON, fail, loadAdjacency, loadSourceRegions, pairKey, simplemapsIdMap } from './lib/common.ts';

const TOLERANCE_KM = 1;
const CELL_KM = 2;

/** Pairs that touch in the file but are deliberately not edges (see data/ADJACENCY_NOTES.md). */
const EXCLUDED_CONTACTS = new Set(['OD-TG', 'AP-PY', 'KL-PY', 'PY-TN']);
/** Edges kept although the file shows no contact (file predates the 2014 Khammam mandal transfer). */
const KEPT_WITHOUT_CONTACT = new Set(['AP-CG']);

type Pt = [number, number];
interface Seg { a: Pt; b: Pt; region: string }

const regions = loadSourceRegions();
const idMap = simplemapsIdMap(regions);
const raw = JSON.parse(readFileSync(RAW_GEOJSON, 'utf8')) as FeatureCollection<Polygon | MultiPolygon>;

// Local equirectangular km: fine for distances of a few km.
const toKm = ([lon, lat]: number[]): Pt => [lon * 111.32 * Math.cos((lat * Math.PI) / 180), lat * 110.57];

const segsByRegion = new Map<string, Seg[]>();
for (const f of raw.features) {
  const id = idMap.get(String(f.properties?.id));
  if (!id) fail(`Unknown SimpleMaps id ${f.properties?.id}`);
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  const segs: Seg[] = [];
  for (const poly of polys)
    for (const ring of poly)
      for (let i = 0; i + 1 < ring.length; i++) segs.push({ a: toKm(ring[i]), b: toKm(ring[i + 1]), region: id });
  segsByRegion.set(id, segs);
}

const grid = new Map<string, Seg[]>();
const cell = (x: number, y: number) => `${Math.floor(x / CELL_KM)},${Math.floor(y / CELL_KM)}`;
for (const segs of segsByRegion.values())
  for (const s of segs) {
    const [x0, x1] = [Math.min(s.a[0], s.b[0]), Math.max(s.a[0], s.b[0])];
    const [y0, y1] = [Math.min(s.a[1], s.b[1]), Math.max(s.a[1], s.b[1])];
    for (let cx = Math.floor(x0 / CELL_KM); cx <= Math.floor(x1 / CELL_KM); cx++)
      for (let cy = Math.floor(y0 / CELL_KM); cy <= Math.floor(y1 / CELL_KM); cy++) {
        const k = `${cx},${cy}`;
        let list = grid.get(k);
        if (!list) grid.set(k, (list = []));
        list.push(s);
      }
  }

function distToSeg(p: Pt, s: Seg): number {
  const [ax, ay] = s.a, [bx, by] = s.b;
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / len2)) : 0;
  return Math.hypot(p[0] - (ax + t * dx), p[1] - (ay + t * dy));
}

/** Regions (other than own) within tolerance of point p. */
function near(p: Pt, own: string): Set<string> {
  const found = new Set<string>();
  const [cx, cy] = cell(p[0], p[1]).split(',').map(Number);
  for (let i = -1; i <= 1; i++)
    for (let j = -1; j <= 1; j++)
      for (const s of grid.get(`${cx + i},${cy + j}`) ?? [])
        if (s.region !== own && !found.has(s.region) && distToSeg(p, s) <= TOLERANCE_KM) found.add(s.region);
  return found;
}

// Contact length ≈ total length of own segments whose both ends lie within tolerance of the other region.
const contactKm = new Map<string, number>();
for (const [id, segs] of segsByRegion) {
  let prev: Set<string> | null = null;
  for (const s of segs) {
    const na = prev ?? near(s.a, id);
    const nb = near(s.b, id);
    for (const other of na) {
      const k = pairKey(id, other);
      if (!contactKm.has(k)) contactKm.set(k, 0);
      if (nb.has(other)) contactKm.set(k, contactKm.get(k)! + Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]) / 2);
    }
    prev = nb;
  }
}

const adj = loadAdjacency();
const graphPairs = new Set<string>();
for (const [a, list] of Object.entries(adj)) for (const b of list) graphPairs.add(pairKey(a, b));
const geoPairs = new Set(contactKm.keys());

const errors: string[] = [];
const notes: string[] = [];
for (const k of [...geoPairs].sort()) {
  if (graphPairs.has(k)) continue;
  const km = contactKm.get(k)!.toFixed(1);
  if (EXCLUDED_CONTACTS.has(k)) notes.push(`excluded  ${k} (touches ~${km} km in the file)`);
  else errors.push(`${k} touches in the map (~${km} km) but is not an edge and not a listed exclusion`);
}
for (const k of [...graphPairs].sort()) {
  if (geoPairs.has(k)) continue;
  if (KEPT_WITHOUT_CONTACT.has(k)) notes.push(`kept      ${k} (no contact in the file)`);
  else errors.push(`${k} is an edge but the shapes do not touch within ${TOLERANCE_KM} km`);
}
for (const k of [...EXCLUDED_CONTACTS, ...KEPT_WITHOUT_CONTACT])
  if (!notes.some((n) => n.includes(` ${k} `))) errors.push(`listed difference ${k} no longer differs — update this script and ADJACENCY_NOTES.md`);

const agree = [...graphPairs].filter((k) => geoPairs.has(k)).length;
console.log(`adjacency check: ${graphPairs.size} edges, ${geoPairs.size} touching pairs in the file, ${agree} agree`);
for (const n of notes) console.log(`  · ${n}`);
const short = [...graphPairs].filter((k) => geoPairs.has(k) && contactKm.get(k)! < 10);
if (short.length) console.log(`  · short borders (<10 km): ${short.map((k) => `${k} ~${contactKm.get(k)!.toFixed(1)} km`).join(', ')}`);
if (errors.length) fail(`Adjacency disagrees with the map:\n  - ${errors.join('\n  - ')}`);
console.log('✓ adjacency matches the map except the documented rulings');
