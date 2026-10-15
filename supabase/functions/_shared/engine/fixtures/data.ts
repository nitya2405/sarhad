// Test fixture: the real committed graph and regions (raw aliases; buildAliasIndex normalises them).
import adjacencyJson from '../../../../../data/adjacency.v1.json';
import regionsJson from '../../../../../data/regions.json';
import type { Adjacency, Region, RegionId } from '../types.ts';
import { buildAliasIndex } from '../resolve.ts';

export const adj: Adjacency = adjacencyJson as Adjacency;
export const regions: Region[] = regionsJson.regions as Region[];
export const index = buildAliasIndex(regions);
export const knownIds: RegionId[] = regions.map((r) => r.id);
export const playableIds: RegionId[] = regions.filter((r) => r.playable).map((r) => r.id);
export const stateIds: RegionId[] = regions.filter((r) => r.kind === 'state').map((r) => r.id);
