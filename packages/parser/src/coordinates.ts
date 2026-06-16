/**
 * Parsing of geographic coordinates printed inline in NOTAM bulletins.
 *
 * The bulletin prints areas in three shapes, all in DMS:
 *   - Polygon:       "45 52 25N/022 53 59E – 45 53 25N/022 55 58E – ..."
 *   - Circle:        "44 18 00N/025 56 00E, R=6NM"  /  "46 32 00N/024 31 45E, R = 5 KM"
 *   - Named vertex:  "TARG(44 18 02N/023 47 17E) - DEDEMAN(44 17 26N/023 50 50E) - ..."
 *
 * Strategy: extract *every* DMS coordinate in the text with one tolerant regex
 * (ignoring whatever separators or labels sit between them), then decide whether
 * the result is a circle (a radius token is present) or a polygon. This is robust
 * to en-dash vs hyphen, missing spaces ("474610N"), and stray spaces ("19 N/ 023").
 */

import circle from '@turf/circle';
import type { Geometry, Polygon } from 'geojson';

export interface LatLon {
  lat: number;
  lon: number;
}

export interface ParsedGeometry {
  geometry: Geometry | null;
  circle?: { centerLon: number; centerLat: number; radiusMeters: number };
  warnings: string[];
}

/**
 * One DMS coordinate: D(D) MM SS hemisphere "/" D(DD) MM SS hemisphere.
 * Spaces between sub-fields are optional (handles "474610N"); spaces around the
 * hemisphere letter and the slash are tolerated.
 */
const COORD_RE =
  /(\d{1,3})\s*(\d{2})\s*(\d{2})\s*([NS])\s*\/\s*(\d{1,3})\s*(\d{2})\s*(\d{2})\s*([EW])/g;

/** Radius token for circle areas: "R=6NM", "R = 5 KM", "R=10 M". */
const RADIUS_RE = /R\s*=\s*([\d.,]+)\s*(NM|KM|M|FT)\b/i;

function dmsToDecimal(deg: number, min: number, sec: number, hemi: string): number {
  const sign = hemi === 'S' || hemi === 'W' ? -1 : 1;
  return sign * (deg + min / 60 + sec / 3600);
}

/** Extract every DMS coordinate in `text`, in order of appearance. */
export function extractCoords(text: string): LatLon[] {
  const out: LatLon[] = [];
  COORD_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = COORD_RE.exec(text)) !== null) {
    const lat = dmsToDecimal(Number(m[1]), Number(m[2]), Number(m[3]), m[4]);
    const lon = dmsToDecimal(Number(m[5]), Number(m[6]), Number(m[7]), m[8]);
    out.push({ lat, lon });
  }
  return out;
}

/** Parse a radius token to meters, or null if absent. */
export function parseRadiusMeters(text: string): number | null {
  const m = RADIUS_RE.exec(text);
  if (!m) return null;
  const value = Number(m[1].replace(',', '.'));
  if (!Number.isFinite(value)) return null;
  switch (m[2].toUpperCase()) {
    case 'NM':
      return value * 1852;
    case 'KM':
      return value * 1000;
    case 'FT':
      return value * 0.3048;
    case 'M':
      return value;
    default:
      return null;
  }
}

/** Plausible bounds for Romanian airspace, used to flag obviously bad parses. */
function inRomania({ lat, lon }: LatLon): boolean {
  return lat >= 43 && lat <= 49 && lon >= 20 && lon <= 30;
}

/**
 * Build a GeoJSON geometry from the free text of a NOTAM description cell.
 * Returns `geometry: null` (with warnings) when no usable area can be formed.
 */
export function parseGeometryFromText(text: string): ParsedGeometry {
  const warnings: string[] = [];
  const coords = extractCoords(text);
  const radiusMeters = parseRadiusMeters(text);

  if (coords.length === 0) {
    return { geometry: null, warnings };
  }

  const outOfBounds = coords.filter((c) => !inRomania(c));
  if (outOfBounds.length > 0) {
    warnings.push(`${outOfBounds.length} coordinate(s) fall outside Romania — check parse`);
  }

  // Circle: a radius token plus a center point.
  if (radiusMeters !== null) {
    const center = coords[0];
    const poly = circle([center.lon, center.lat], radiusMeters / 1000, {
      steps: 64,
      units: 'kilometers',
    });
    return {
      geometry: poly.geometry,
      circle: { centerLon: center.lon, centerLat: center.lat, radiusMeters },
      warnings,
    };
  }

  // Polygon: need at least 3 distinct vertices.
  if (coords.length >= 3) {
    const ring = coords.map((c) => [c.lon, c.lat] as [number, number]);
    // Close the ring if not already closed.
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) ring.push(first);
    const geometry: Polygon = { type: 'Polygon', coordinates: [ring] };
    return { geometry, warnings };
  }

  // 1–2 points and no radius: cannot form an area.
  warnings.push(`only ${coords.length} coordinate(s) found and no radius — cannot form an area`);
  return { geometry: null, warnings };
}
