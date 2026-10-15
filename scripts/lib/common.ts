// Shared helpers for the build-time data scripts (Node only, never shipped to the browser).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const p = (...parts: string[]) => resolve(ROOT, ...parts);

export const RAW_GEOJSON = p('data/raw/simplemaps-in-admin1.geojson');
export const REGIONS_SRC = p('data/regions.json');
export const ADJACENCY_SRC = p('data/adjacency.v1.json');
export const ADJACENCY_VERSION = 1;

export interface SourceRegion {
  id: string;
  kind: 'state' | 'ut';
  playable: boolean;
  name: { en: string; hi: string };
  aliases: string[];
  simplemapsId: string;
}

export function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, 'utf8')) as T;
}

/** Writes JSON (compact unless pretty) and returns the byte size. */
export function writeJson(file: string, data: unknown, pretty = false): number {
  mkdirSync(dirname(file), { recursive: true });
  const text = (pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data)) + '\n';
  writeFileSync(file, text);
  return Buffer.byteLength(text);
}

export function loadSourceRegions(): SourceRegion[] {
  return readJson<{ version: number; regions: SourceRegion[] }>(REGIONS_SRC).regions;
}

export function loadAdjacency(): Record<string, string[]> {
  return readJson<Record<string, string[]>>(ADJACENCY_SRC);
}

/** SimpleMaps feature id (e.g. 'INOR') → our id ('OD'). */
export function simplemapsIdMap(regions: SourceRegion[]): Map<string, string> {
  return new Map(regions.map((r) => [r.simplemapsId, r.id]));
}

export function fail(msg: string): never {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

export const pairKey = (a: string, b: string) => (a < b ? `${a}-${b}` : `${b}-${a}`);
