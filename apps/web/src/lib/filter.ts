/**
 * Pure NOTAM filtering. The same filter state drives both the map and the list,
 * so this module is the single source of truth for "is this NOTAM visible".
 */

import booleanIntersects from '@turf/boolean-intersects';
import { feature } from '@turf/helpers';
import type { Activity, AreaType } from '@notam/parser';
import type { Feature, Polygon } from 'geojson';
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
  /** User-drawn area-of-interest polygon, or null. */
  drawnArea: Polygon | null;
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

export interface FilterResult {
  visible: LoadedNotam[];
  /** NOTAMs excluded purely because they lack geometry under a spatial filter. */
  hiddenNoGeometry: number;
}

export function applyFilters(notams: LoadedNotam[], f: FilterState): FilterResult {
  let hiddenNoGeometry = 0;
  const area: Feature<Polygon> | null = f.drawnArea ? feature(f.drawnArea) : null;

  const visible = notams.filter((n) => {
    if (f.areaTypes.size > 0 && !f.areaTypes.has(n.areaType)) return false;
    if (f.activities.size > 0 && !n.activities.some((a) => f.activities.has(a))) return false;
    if (!altitudeOverlaps(n, f.flMin, f.flMax)) return false;
    if (!timeOverlaps(n, f.timeFrom, f.timeTo)) return false;
    if (area) {
      if (!n.geometry) {
        hiddenNoGeometry++;
        return false;
      }
      if (!booleanIntersects(area, feature(n.geometry))) return false;
    }
    return true;
  });

  return { visible, hiddenNoGeometry };
}
