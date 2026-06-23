/**
 * Pure NOTAM filtering. The same filter state drives both the map and the list,
 * so this module is the single source of truth for "is this NOTAM visible".
 */

import booleanIntersects from '@turf/boolean-intersects';
import { feature } from '@turf/helpers';
import {
  bandsOverlap,
  classifyTmaMembership,
  isLrManagedZone,
  type Activity,
  type AreaType,
} from '@notam/parser';
import type { Feature, Polygon } from 'geojson';
import { isAllocatedTo } from './allocations';
import { findTma } from './tma';
import type { LoadedNotam } from './types';

export interface FilterState {
  areaTypes: Set<AreaType>;
  activities: Set<Activity>;
  /** Flight-level band in feet AMSL. */
  flMin: number;
  flMax: number;
  /** ISO time window (inclusive). Empty string = unbounded. */
  timeFrom: string;
  timeTo: string;
  /** Area-of-interest polygon (a TMA preset or a custom drawn rectangle), or null. */
  drawnArea: Polygon | null;
  /**
   * Vertical slab (feet AMSL) of the active area-of-interest, applied on top of
   * the lateral test. Set for TMA presets (3-D); null for a custom drawn area
   * (lateral only).
   */
  areaFloorFt: number | null;
  areaCeilingFt: number | null;
  /**
   * Active TMA preset id (e.g. "TMA_NAPOC"), or null for a custom drawn area.
   * When set, NOTAMs allocated to that TMA pass the area test regardless of
   * geometry (authority allocation).
   */
  areaTmaId: string | null;
}

export const FL_FLOOR = 0;
export const FL_CEILING = 66000; // ft — covers the bulletin's FL 660 max

export function defaultFilters(): FilterState {
  return {
    areaTypes: new Set(),
    activities: new Set(),
    flMin: FL_FLOOR,
    flMax: FL_CEILING,
    timeFrom: '',
    timeTo: '',
    drawnArea: null,
    areaFloorFt: null,
    areaCeilingFt: null,
    areaTmaId: null,
  };
}

/** [aLow,aHigh] overlaps [bLow,bHigh]; unknown (NaN) limits never exclude. */
function altitudeOverlaps(n: LoadedNotam, lo: number, hi: number): boolean {
  const nLow = Number.isFinite(n.lower.feet) ? n.lower.feet : FL_FLOOR;
  const nHigh = Number.isFinite(n.upper.feet) ? n.upper.feet : FL_CEILING;
  return nLow <= hi && nHigh >= lo;
}

/** Any activation window overlaps [from,to]; no windows => always passes. */
function timeOverlaps(n: LoadedNotam, from: string, to: string): boolean {
  if (!from && !to) return true;
  if (n.schedules.length === 0) return true;
  const f = from ? Date.parse(from) : -Infinity;
  const t = to ? Date.parse(to) : Infinity;
  return n.schedules.some((s) => {
    const sf = s.fromUTC ? Date.parse(s.fromUTC) : -Infinity;
    const st = s.toUTC ? Date.parse(s.toUTC) : Infinity;
    return sf <= t && st >= f;
  });
}

/** An unallocated LRTRA/LRTSA/LRD zone physically present in the active TMA. */
export interface LrPresent {
  notam: LoadedNotam;
  where: 'in' | 'buffer';
}

export interface FilterResult {
  visible: LoadedNotam[];
  /** NOTAMs excluded purely because they lack geometry under a spatial filter. */
  hiddenNoGeometry: number;
  /**
   * Awareness set (TMA preset only): LRTRA/LRTSA/LRD zones that physically reach the
   * active TMA but are NOT allocated to it — surfaced separately, not "relevant".
   */
  lrUnallocated: LrPresent[];
}

function altFeet(n: LoadedNotam): [number, number] {
  const low = Number.isFinite(n.lower.feet) ? n.lower.feet : FL_FLOOR;
  const high = Number.isFinite(n.upper.feet) ? n.upper.feet : FL_CEILING;
  return [low, high];
}

export function applyFilters(notams: LoadedNotam[], f: FilterState): FilterResult {
  let hiddenNoGeometry = 0;
  const lrUnallocated: LrPresent[] = [];
  const area: Feature<Polygon> | null = f.drawnArea ? feature(f.drawnArea) : null;
  // True (unbuffered) boundary of the active TMA preset, for the in/buffer split.
  const tmaTrue = f.areaTmaId ? findTma(f.areaTmaId)?.geometry : undefined;
  const trueFeat = tmaTrue ? feature(tmaTrue) : null;

  const visible = notams.filter((n) => {
    // --- non-spatial filters (apply to everything, including the LR awareness set) ---
    if (f.areaTypes.size > 0 && !f.areaTypes.has(n.areaType)) return false;
    if (f.activities.size > 0 && !n.activities.some((a) => f.activities.has(a))) return false;
    if (!altitudeOverlaps(n, f.flMin, f.flMax)) return false;
    if (!timeOverlaps(n, f.timeFrom, f.timeTo)) return false;
    if (!area) return true;

    const allocated = f.areaTmaId ? isAllocatedTo(n, f.areaTmaId) : false;

    // --- TMA preset: apply the AIP-managed-zone rule + capture awareness set ---
    if (f.areaTmaId) {
      // 3-D geometric facts against the buffer (lateral) and true boundary.
      let inBuffer = false;
      let inTrue = false;
      if (n.geometry) {
        const nf = feature(n.geometry);
        const [low, high] = altFeet(n);
        const vert =
          f.areaFloorFt == null || f.areaCeilingFt == null
            ? true
            : bandsOverlap(low, high, f.areaFloorFt, f.areaCeilingFt);
        inBuffer = booleanIntersects(area, nf) && vert;
        inTrue = inBuffer && !!trueFeat && booleanIntersects(trueFeat, nf);
      }
      const rel = classifyTmaMembership({
        isLr: isLrManagedZone(n),
        allocated,
        inBuffer,
        inTrue,
      });
      if (rel.kind === 'relevant') return true;
      if (rel.kind === 'lr-present') {
        lrUnallocated.push({ notam: n, where: rel.where });
        return false;
      }
      if (!n.geometry) hiddenNoGeometry++; // unplaceable, not allocated → hidden count
      return false;
    }

    // --- Custom drawn area (no TMA): pure geometric, lateral (+ slab if set) ---
    if (!n.geometry) {
      hiddenNoGeometry++;
      return false;
    }
    if (!booleanIntersects(area, feature(n.geometry))) return false;
    if (f.areaFloorFt != null && f.areaCeilingFt != null) {
      const [low, high] = altFeet(n);
      if (!bandsOverlap(low, high, f.areaFloorFt, f.areaCeilingFt)) return false;
    }
    return true;
  });

  return { visible, hiddenNoGeometry, lrUnallocated };
}
