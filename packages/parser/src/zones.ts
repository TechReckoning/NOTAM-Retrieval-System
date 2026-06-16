/**
 * Airspace-zone gazetteer resolver.
 *
 * Named-zone NOTAMs (LRTRA / LRD / LRTSA ...) carry no inline coordinates; their
 * shapes come from the Romanian AIP. This module resolves a NOTAM's `zoneRefs`
 * to geometry using a gazetteer GeoJSON. Until that file is supplied, resolution
 * is a no-op and those NOTAMs stay "geometry pending" — but everything else
 * (list, non-spatial filters) works unchanged.
 */

import type { FeatureCollection, Geometry, MultiPolygon, Polygon } from 'geojson';
import type { Notam, ZoneFeature } from './types.js';

/** Canonicalize a designator for matching: uppercase, single-spaced. */
export function normalizeDesignator(d: string): string {
  return d.toUpperCase().replace(/\s+/g, ' ').trim();
}

export type ZoneIndex = Map<string, ZoneFeature>;

/** Index a gazetteer FeatureCollection by canonical designator. */
export function buildZoneIndex(fc: FeatureCollection<Polygon, { designator: string }>): ZoneIndex {
  const idx: ZoneIndex = new Map();
  for (const f of fc.features) {
    const des = f.properties?.designator;
    if (des) idx.set(normalizeDesignator(des), f as ZoneFeature);
  }
  return idx;
}

/** Combine one or more polygons into a single geometry (Polygon or MultiPolygon). */
function combine(polys: Polygon[]): Geometry | null {
  if (polys.length === 0) return null;
  if (polys.length === 1) return polys[0];
  const mp: MultiPolygon = {
    type: 'MultiPolygon',
    coordinates: polys.map((p) => p.coordinates),
  };
  return mp;
}

/**
 * Return a copy of `notam` with geometry resolved from the gazetteer when it has
 * named zones and no inline geometry. Unresolved designators are flagged.
 */
export function resolveGeometry(notam: Notam, idx: ZoneIndex): Notam {
  if (notam.geometry || notam.zoneRefs.length === 0) return notam;

  const found: Polygon[] = [];
  const missing: string[] = [];
  for (const ref of notam.zoneRefs) {
    const feat = idx.get(normalizeDesignator(ref));
    if (feat) found.push(feat.geometry);
    else missing.push(ref);
  }

  const geometry = combine(found);
  const warnings = notam.warnings.filter((w) => !w.startsWith('geometry pending'));
  if (missing.length) {
    warnings.push(`zone(s) not in gazetteer: ${missing.join(', ')}`);
  }

  return {
    ...notam,
    geometry: geometry ?? notam.geometry,
    geometrySource: geometry ? 'gazetteer' : notam.geometrySource,
    warnings,
  };
}

/** Resolve geometry for every NOTAM against the gazetteer. */
export function applyGazetteer(
  notams: Notam[],
  fc: FeatureCollection<Polygon, { designator: string }>,
): Notam[] {
  const idx = buildZoneIndex(fc);
  return notams.map((n) => resolveGeometry(n, idx));
}
