/**
 * Spatial bucketing: partition NOTAMs (or any geometry-bearing items) into the
 * predefined areas they intersect. Used by the app's List View Mode to group the
 * filter-matched NOTAMs per TMA. Pure and unit-tested.
 */

import booleanIntersects from '@turf/boolean-intersects';
import { feature } from '@turf/helpers';
import type { Geometry, Polygon } from 'geojson';

export interface AreaPolygon {
  id: string;
  geometry: Polygon;
}

export interface BucketResult<T> {
  /** areaId -> items whose geometry intersects that area. An item that intersects
   *  several areas appears under each of them. */
  byArea: Record<string, T[]>;
  /** items with no geometry (cannot be placed in any area). */
  noGeometry: T[];
  /** items that have geometry but intersect none of the areas. */
  outside: T[];
}

export function bucketByAreas<T extends { geometry: Geometry | null }>(
  items: T[],
  areas: AreaPolygon[],
): BucketResult<T> {
  const byArea: Record<string, T[]> = {};
  for (const a of areas) byArea[a.id] = [];
  const areaFeatures = areas.map((a) => ({ id: a.id, f: feature(a.geometry) }));

  const noGeometry: T[] = [];
  const outside: T[] = [];

  for (const item of items) {
    if (!item.geometry) {
      noGeometry.push(item);
      continue;
    }
    const itemFeature = feature(item.geometry);
    let matchedAny = false;
    for (const { id, f } of areaFeatures) {
      if (booleanIntersects(f, itemFeature)) {
        byArea[id].push(item);
        matchedAny = true;
      }
    }
    if (!matchedAny) outside.push(item);
  }

  return { byArea, noGeometry, outside };
}
