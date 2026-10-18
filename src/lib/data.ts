// The only module that touches the generated static data (src/data/*, owned by the data scripts).
import regionsJson from '../data/regions.json';
import adjacencyJson from '../data/adjacency.json';
import puzzlesJson from '../data/puzzles.json';
import { bundledSchedule } from '@schedule';
import {
  buildAliasIndex,
  type AliasIndex,
  type Adjacency,
  type Puzzle,
  type Region,
  type RegionId,
} from '@engine/index.ts';

function listOf<T>(json: unknown, key: string): T[] {
  if (Array.isArray(json)) return json as T[];
  return ((json as Record<string, unknown>)[key] ?? []) as T[];
}

export const regions: Region[] = listOf<Region>(regionsJson, 'regions');
export const adjacency = adjacencyJson as unknown as Adjacency;
export const puzzles: Puzzle[] = listOf<Puzzle>(puzzlesJson, 'puzzles');
/** null in server builds: the daily pair then comes only from start_daily. */
export const schedule = bundledSchedule;

export const regionById = new Map(regions.map((r) => [r.id, r]));
/** the 33 states and UTs with a land border (the islands are not playable) */
export const playableIds: ReadonlySet<RegionId> = new Set(regions.filter((r) => r.playable).map((r) => r.id));
const puzzleById = new Map(puzzles.map((p) => [p.id, p]));
const dailyByDate = new Map((schedule?.entries ?? []).map((e) => [e.date, e.puzzleId]));

let index: AliasIndex | null = null;
export function aliasIndex(): AliasIndex {
  return (index ??= buildAliasIndex(regions));
}

export function getPuzzle(id: string): Puzzle | undefined {
  return puzzleById.get(id);
}

/** Today's daily puzzle for an IST date from the bundled schedule (offline builds only). */
export function dailyPuzzle(date: string): Puzzle | undefined {
  const id = dailyByDate.get(date);
  return id ? puzzleById.get(id) : undefined;
}

export function randomPracticePuzzle(excludeId?: string): Puzzle {
  const pool = puzzles.filter((p) => p.id !== excludeId);
  return pool[Math.floor(Math.random() * pool.length)];
}

const SHORT: Record<RegionId, string> = {
  AN: 'A & N Islands',
  DD: 'DNH & DD',
  JK: 'J & K',
};

export function regionName(id: RegionId): string {
  return regionById.get(id)?.name.en ?? id;
}

/** Shorter label for the map. */
export function mapLabel(id: RegionId): string {
  return SHORT[id] ?? regionName(id);
}

export interface MapData {
  viewBox: string | number[];
  regions: Record<RegionId, { d: string; label: [number, number] }>;
}

/** Loaded lazily so the game stays playable from the guess list if the map fails (F6). */
export async function loadMap(): Promise<MapData | null> {
  try {
    const m = await import('../data/map.json');
    return (m.default ?? m) as unknown as MapData;
  } catch {
    return null;
  }
}
