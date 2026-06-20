/**
 * Overlap (conflict) detection among NOTAMs relevant to a TMA.
 *
 * Two NOTAMs "overlap" when they are BOTH active at the operational time, their
 * footprints intersect, and their vertical bands genuinely overlap (not merely
 * touch at a shared level — so stacked sub-layers of one zone don't count).
 *
 * Overlaps where every participant is a military-only NOTAM are excluded (those
 * are coordinated/expected); any overlap involving a non-military NOTAM is kept.
 */

import bbox from '@turf/bbox';
import booleanIntersects from '@turf/boolean-intersects';
import { feature } from '@turf/helpers';
import { applyFilters, type FilterState } from './filter';
import { statusFor } from './status';
import type { LoadedNotam } from './types';

function isMilitaryOnly(n: LoadedNotam): boolean {
  return n.activities.length > 0 && n.activities.every((a) => a === 'MIL_TRAINING');
}

function band(n: LoadedNotam): [number, number] {
  const lo = Number.isFinite(n.lower.feet) ? n.lower.feet : 0;
  const hi = Number.isFinite(n.upper.feet) ? n.upper.feet : Number.POSITIVE_INFINITY;
  return [lo, hi];
}

/** Strict vertical overlap — a shared boundary level alone does not count. */
function verticalOverlapStrict(a: LoadedNotam, b: LoadedNotam): boolean {
  const [al, ah] = band(a);
  const [bl, bh] = band(b);
  return al < bh && ah > bl;
}

type Bbox = [number, number, number, number];
function bboxOverlap(a: Bbox, b: Bbox): boolean {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}

export interface OverlapPair {
  a: LoadedNotam;
  b: LoadedNotam;
}

export interface OverlapReport {
  pairs: OverlapPair[];
  /** uid -> uids it overlaps with (for the per-NOTAM flag). */
  partners: Map<string, string[]>;
}

const EMPTY: OverlapReport = { pairs: [], partners: new Map() };

export function buildOverlaps(notams: LoadedNotam[], opTimeIso: string): OverlapReport {
  // Only co-active NOTAMs with geometry can form a simultaneous conflict.
  const active = notams.filter((n) => n.geometry && statusFor(n, opTimeIso) === 'active');
  if (active.length < 2) return EMPTY;

  const boxes = active.map((n) => bbox(n.geometry!) as Bbox);
  const feats = active.map((n) => feature(n.geometry!));

  const pairs: OverlapPair[] = [];
  const partners = new Map<string, string[]>();
  const add = (k: string, v: string) => {
    const arr = partners.get(k);
    if (arr) arr.push(v);
    else partners.set(k, [v]);
  };

  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i];
      const b = active[j];
      if (isMilitaryOnly(a) && isMilitaryOnly(b)) continue; // mil-only excluded
      if (!bboxOverlap(boxes[i], boxes[j])) continue; // cheap reject
      if (!verticalOverlapStrict(a, b)) continue;
      if (!booleanIntersects(feats[i], feats[j])) continue;
      pairs.push({ a, b });
      add(a.uid, b.uid);
      add(b.uid, a.uid);
    }
  }
  return { pairs, partners };
}

/**
 * The NOTAM set overlaps are computed over, matching the current view's filtered
 * set (Map View honours the TMA/area filter; List View ignores the map-only
 * spatial controls just as the columns do).
 */
export function overlapScopeSet(
  notams: LoadedNotam[],
  filters: FilterState,
  viewMode: 'map' | 'list',
): LoadedNotam[] {
  const f = viewMode === 'map' ? filters : { ...filters, drawnArea: null };
  return applyFilters(notams, f).visible;
}
