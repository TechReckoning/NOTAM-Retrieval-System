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

import buffer from '@turf/buffer';
import circle from '@turf/circle';
import { lineString } from '@turf/helpers';
import kinks from '@turf/kinks';
import type { Geometry, Polygon } from 'geojson';

export interface LatLon {
  lat: number;
  lon: number;
}

/** Position pair, GeoJSON order [lon, lat]. */
type Position = [number, number];

/**
 * Build a closed polygon ring from ordered coordinates, truncating at the first
 * ring closure (a vertex that repeats the start). The AIP closes a polygon by
 * repeating its first vertex; anything printed after that (free-text "Note:" or
 * "except …" clauses that themselves contain coordinates) is not part of the area
 * and must be dropped, otherwise the ring self-intersects.
 */
export function coordsToRing(coords: LatLon[]): Position[] {
  const eq = (a: Position, b: Position) =>
    Math.abs(a[0] - b[0]) < 1e-7 && Math.abs(a[1] - b[1]) < 1e-7;
  const start: Position = [coords[0].lon, coords[0].lat];
  const ring: Position[] = [start];
  for (let i = 1; i < coords.length; i++) {
    const p: Position = [coords[i].lon, coords[i].lat];
    if (eq(p, ring[ring.length - 1])) continue; // drop duplicate consecutive vertex
    ring.push(p);
    if (eq(p, start)) return ring; // closed — ignore any trailing coordinates
  }
  if (!eq(ring[ring.length - 1], start)) ring.push(start);
  return ring;
}

/** Corridor width token, e.g. "5 NM S/D" (5 NM each side of the centre line). */
const CORRIDOR_RE = /([\d.]+)\s*NM\s*S\s*\/?\s*D/i;

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

  // Corridor: a centre line traced through the points, with a stated width
  // ("N NM S/D" = N NM either side). The real airspace is the line buffered by
  // that width — NOT the (self-intersecting) polygon of connecting the points.
  const corridor = CORRIDOR_RE.exec(text);
  if (corridor) {
    // Corridors are listed out-and-back over the same waypoints; collapse to the
    // unique one-way centre line so buffering doesn't fold a doubled line onto
    // itself.
    const line = uniquePoints(coords);
    if (line.length >= 2) {
      const widthNm = Number(corridor[1]);
      const buffered = buffer(lineString(line.map((c) => [c.lon, c.lat])), widthNm * 1.852, {
        units: 'kilometers',
      });
      if (buffered?.geometry) {
        if (buffered.geometry.type === 'Polygon') {
          warnings.push(...selfIntersectionWarning(buffered.geometry));
        }
        return { geometry: buffered.geometry, warnings };
      }
      warnings.push('corridor buffer failed — falling back to polygon');
    }
  }

  // Polygon: need at least 3 distinct vertices.
  if (coords.length >= 3) {
    const ring = coordsToRing(coords);
    const geometry: Polygon = { type: 'Polygon', coordinates: [ring] };
    warnings.push(...selfIntersectionWarning(geometry));
    return { geometry, warnings };
  }

  // 1–2 points and no radius: cannot form an area.
  warnings.push(`only ${coords.length} coordinate(s) found and no radius — cannot form an area`);
  return { geometry: null, warnings };
}

/** Unique points preserving first-appearance order (collapses out-and-back paths). */
function uniquePoints(coords: LatLon[]): LatLon[] {
  const seen = new Set<string>();
  const out: LatLon[] = [];
  for (const c of coords) {
    const key = `${c.lon.toFixed(6)},${c.lat.toFixed(6)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

/** Warn (do not silently accept) if a polygon ring self-intersects. */
export function selfIntersectionWarning(geometry: Polygon): string[] {
  try {
    if (kinks(geometry).features.length > 0) {
      return ['self-intersecting polygon — lateral overlap results may be unreliable'];
    }
  } catch {
    /* ignore — validation best-effort */
  }
  return [];
}
