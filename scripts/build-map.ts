// Raw SimpleMaps GeoJSON → src/data/map.json { viewBox, regions: { ID: { d, label: [x, y] } } }
// and src/data/minimap.json { viewBox, regions: { ID: d } } (coarse, for the Home card).
// Ids are remapped, geometry projected (Lambert conformal conic for India) and simplified with
// mapshaper on shared arcs (topology-preserving, so neighbours keep a common edge: no gaps),
// then fitted to the viewBox with d3-geo and serialised as SVG paths with 1-decimal coordinates.
import mapshaper from 'mapshaper';
import { geoIdentity, geoPath } from 'd3-geo';
import polylabel from 'polylabel';
import { gzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from 'geojson';
import { RAW_GEOJSON, fail, loadSourceRegions, p, simplemapsIdMap, writeJson } from './lib/common.ts';

const WIDTH = 1000;
const PAD = 8;
const SIMPLIFY = '15%';
/** Home card mini map: same projection, far coarser, integer coordinates. */
const MINI_SIMPLIFY = '1.5%';
const MINI_MAX_GZ = 8 * 1024;
const PROJ = '+proj=lcc +lat_1=12 +lat_2=28 +lat_0=22 +lon_0=80 +datum=WGS84 +units=m';

type Geom = Polygon | MultiPolygon;

const regions = loadSourceRegions();
const idMap = simplemapsIdMap(regions);
const raw = JSON.parse(readFileSync(RAW_GEOJSON, 'utf8')) as FeatureCollection<Geom>;

for (const f of raw.features) {
  const id = idMap.get(String(f.properties?.id));
  if (!id) fail(`Unknown SimpleMaps id ${f.properties?.id}`);
  f.properties = { id };
}

const out = await mapshaper.applyCommands(
  `-i in.json -proj ${PROJ} -simplify ${SIMPLIFY} keep-shapes planar -o out.json format=geojson precision=1`,
  { 'in.json': JSON.stringify(raw) },
);
const simplified = JSON.parse(String(out['out.json'])) as FeatureCollection<Geom>;

// Planar, y-up metres → SVG units (y-down), fitted to WIDTH with padding.
const projection = geoIdentity().reflectY(true).fitExtent([[0, 0], [WIDTH - 2 * PAD, 1e6]], simplified);
const [[x0, y0], [x1, y1]] = geoPath(projection).bounds(simplified);
const [tx, ty] = projection.translate();
projection.translate([tx - x0 + PAD, ty - y0 + PAD]);
const height = Math.ceil(y1 - y0 + 2 * PAD);
const path = geoPath(projection).digits(1);

const round1 = (n: number) => Math.round(n * 10) / 10;
const ringArea = (ring: Position[]) => {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  return Math.abs(a / 2);
};

const mapRegions: Record<string, { d: string; label: [number, number] }> = {};
for (const f of simplified.features as Feature<Geom>[]) {
  const id = String(f.properties?.id);
  const d = path(f);
  if (!d) fail(`Empty path for ${id}`);
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  const projected = polys.map((poly) => poly.map((ring) => ring.map((pt) => projection(pt as [number, number])!)));
  // Label goes on the largest piece, except DD: the file's Diu piece is slightly larger than
  // Dadra & Nagar Haveli, but DNH (the easternmost piece) is the one that links GJ and MH.
  const minX = (poly: number[][][]) => Math.min(...poly[0].map((pt) => pt[0]));
  const piece =
    id === 'DD'
      ? projected.reduce((a, b) => (minX(b) > minX(a) ? b : a))
      : projected.reduce((a, b) => (ringArea(b[0]) > ringArea(a[0]) ? b : a));
  const lp = polylabel(piece, 0.5);
  mapRegions[id] = { d, label: [round1(lp[0]), round1(lp[1])] };
}

const expected = regions.map((r) => r.id);
const missing = expected.filter((id) => !mapRegions[id]);
if (missing.length || Object.keys(mapRegions).length !== 36) fail(`map.json must have all 36 ids; missing: ${missing.join(', ')}`);

const sorted = Object.fromEntries(Object.keys(mapRegions).sort().map((id) => [id, mapRegions[id]]));
const bytes = writeJson(p('src/data/map.json'), { viewBox: `0 0 ${WIDTH} ${height}`, regions: sorted });
const gz = gzipSync(readFileSync(p('src/data/map.json'))).length;
console.log(`✓ map.json: 36 regions, viewBox 0 0 ${WIDTH} ${height}, ${(bytes / 1024).toFixed(1)} KB (${(gz / 1024).toFixed(1)} KB gzip)`);
if (bytes > 120 * 1024) fail('map.json exceeds 120 KB');

// Mini map: same projection and viewBox, so it lines up with map.json.
const miniOut = await mapshaper.applyCommands(
  `-i in.json -proj ${PROJ} -simplify ${MINI_SIMPLIFY} keep-shapes planar -o out.json format=geojson precision=1`,
  { 'in.json': JSON.stringify(raw) },
);
const mini = JSON.parse(String(miniOut['out.json'])) as FeatureCollection<Geom>;
const miniPath = geoPath(projection).digits(0);
const miniRegions: Record<string, string> = {};
for (const f of mini.features as Feature<Geom>[]) miniRegions[String(f.properties?.id)] = miniPath(f) ?? '';
const miniMissing = expected.filter((id) => !miniRegions[id]);
if (miniMissing.length) fail(`minimap.json missing: ${miniMissing.join(', ')}`);
const miniSorted = Object.fromEntries(Object.keys(miniRegions).sort().map((id) => [id, miniRegions[id]]));
const miniBytes = writeJson(p('src/data/minimap.json'), { viewBox: `0 0 ${WIDTH} ${height}`, regions: miniSorted });
const miniGz = gzipSync(readFileSync(p('src/data/minimap.json'))).length;
console.log(`✓ minimap.json: ${(miniBytes / 1024).toFixed(1)} KB (${(miniGz / 1024).toFixed(1)} KB gzip)`);
if (miniGz > MINI_MAX_GZ) fail('minimap.json exceeds 8 KB gzip');
