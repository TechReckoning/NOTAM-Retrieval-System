/**
 * TMA restriction allocation: which TMA(s) a NOTAM is administratively allocated
 * to, by exact zone designator. Independent of geometry — an allocated restriction
 * is relevant to its TMA even when its area lies outside the TMA boundary.
 */

import { normalizeDesignator } from './zones.js';

/** Authority allocation: TMA id -> list of (canonical) restriction designators. */
export type AllocationTable = Record<string, string[]>;

/** Index of normalized designator -> TMA ids it is allocated to. */
export type AllocationIndex = Map<string, string[]>;

export function buildAllocationIndex(table: AllocationTable): AllocationIndex {
  const idx: AllocationIndex = new Map();
  for (const [tma, designators] of Object.entries(table)) {
    if (tma.startsWith('_')) continue; // skip metadata keys like "_comment"
    for (const d of designators) {
      const key = normalizeDesignator(d);
      const arr = idx.get(key);
      if (arr) {
        if (!arr.includes(tma)) arr.push(tma);
      } else {
        idx.set(key, [tma]);
      }
    }
  }
  return idx;
}

/** TMA ids a NOTAM (by its zone designators) is allocated to. */
export function allocatedTmas(zoneRefs: string[], index: AllocationIndex): string[] {
  const out = new Set<string>();
  for (const ref of zoneRefs) {
    for (const tma of index.get(normalizeDesignator(ref)) ?? []) out.add(tma);
  }
  return Array.from(out);
}
