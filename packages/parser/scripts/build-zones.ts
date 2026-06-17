/**
 * Build the airspace-zone gazetteer (data/zones/ro-airspace.geojson) from the AIP
 * ENR 5.1 (Prohibited/Restricted/Danger) and ENR 5.2 (Military training areas)
 * lateral limits. Source text is `data/zones/source/enr_5_*.txt`, extracted from
 * the official PDFs with `pdftotext -layout`.
 *
 * Each area is a coordinate polygon or a "Circle of N NM/KM radius centred on …".
 * Coordinates are parsed with the same tested DMS parser used everywhere else.
 *
 * Run: npm run zones -w packages/parser
 */

import circle from '@turf/circle';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Feature, Polygon } from 'geojson';
import { canonicalDesignator, coordsToRing, extractCoords, selfIntersectionWarning } from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ZONES = resolve(__dirname, '../../../data/zones');

const SOURCES = [
  { file: 'enr_5_1.txt', source: 'AIP ENR 5.1' },
  { file: 'enr_5_2.txt', source: 'AIP ENR 5.2' },
];

const TYPE_BY_PREFIX: Record<string, string> = {
  LRD: 'DANGER',
  LRR: 'RESTRICTED',
  LRP: 'PROHIBITED',
  LRTRA: 'TEMP_RESERVED',
  LRTSA: 'TEMP_SEGREGATED',
};

const DESIGNATOR_LINE = /^(LR[A-Z]+\d+[A-Z]*)\b(.*)$/;

/** The AIP prints lat/lon separated by a space; the parser expects "/". */
const withSlash = (s: string): string => s.replace(/([NS])\s+(\d)/g, '$1/$2');

/**
 * Radius of a circular area, in meters, or null. Handles both AIP phrasings:
 * "Circle of 6 NM radius centred on …" and "A circle, radius 20NM centred at …"
 * (and the "(NN KM)" parenthetical / US "centered" spelling).
 */
function radiusMeters(text: string): number | null {
  const m =
    /Circle of\s+([\d.]+)\s*(NM|KM)/i.exec(text) ?? /radius[,:\s]+([\d.]+)\s*(NM|KM)/i.exec(text);
  if (!m) return null;
  const v = Number(m[1]);
  if (!Number.isFinite(v)) return null;
  return m[2].toUpperCase() === 'KM' ? v * 1000 : v * 1852;
}

interface Block {
  desRaw: string;
  firstLineRest: string;
  body: string[];
}

function inRomania(lon: number, lat: number): boolean {
  return lat >= 43 && lat <= 49.5 && lon >= 20 && lon <= 30.5;
}

function zoneName(firstLineRest: string): string | undefined {
  // Name sits left of the column gap; remarks ("Active: by NOTAM") sit right.
  const left = firstLineRest.split(/\s{2,}/)[0]?.replace(/[()]/g, '').trim();
  if (!left || /^(ACTIVE|AIRSPACE|VERTICAL|FL\d|GND|\d)/i.test(left)) return undefined;
  return left;
}

function buildGeometry(block: Block): { geometry: Polygon; warning?: string } | null {
  // Keep only the left "lateral limits" column of each line — pdftotext -layout
  // separates columns by a wide gap, and the vertical-limit/remarks columns can
  // otherwise interleave between a coordinate's latitude and longitude.
  const leftColumn = block.body.map((l) => l.split(/\s{3,}/)[0]).join(' ');
  const text = withSlash(leftColumn);
  const meters = radiusMeters(text);
  const coords = extractCoords(text);
  if (coords.length === 0) return null;

  if (meters != null) {
    const c = coords[0];
    const poly = circle([c.lon, c.lat], meters / 1000, { steps: 64, units: 'kilometers' });
    return { geometry: poly.geometry };
  }

  if (coords.length >= 3) {
    // coordsToRing truncates at the ring's closing vertex, so trailing "Note:" /
    // "except …" coordinates in the source block don't pollute the polygon.
    const ring = coordsToRing(coords).map(([lon, lat]) => [
      Number(lon.toFixed(6)),
      Number(lat.toFixed(6)),
    ]);
    const geometry: Polygon = { type: 'Polygon', coordinates: [ring] };
    const warn = selfIntersectionWarning(geometry)[0];
    return warn ? { geometry, warning: warn } : { geometry };
  }
  return { geometry: { type: 'Polygon', coordinates: [] }, warning: 'too few coordinates' };
}

function parseFile(path: string): Block[] {
  const blocks: Block[] = [];
  let current: Block | null = null;
  for (const line of readFileSync(path, 'utf-8').split(/\r?\n/)) {
    const dm = DESIGNATOR_LINE.exec(line);
    if (dm) {
      if (current) blocks.push(current);
      current = { desRaw: dm[1], firstLineRest: dm[2], body: [] };
    } else if (current) {
      current.body.push(line);
    }
  }
  if (current) blocks.push(current);
  return blocks;
}

function main(): void {
  const features: Feature[] = [];
  const seen = new Set<string>();
  const skipped: string[] = [];
  const oob: string[] = [];
  const selfInt: string[] = [];

  for (const { file, source } of SOURCES) {
    for (const block of parseFile(resolve(ZONES, 'source', file))) {
      const designator = canonicalDesignator(block.desRaw);
      if (!designator) {
        skipped.push(block.desRaw);
        continue;
      }
      if (seen.has(designator)) continue;
      const geom = buildGeometry(block);
      if (!geom || geom.geometry.coordinates.length === 0) {
        skipped.push(block.desRaw);
        continue;
      }
      const ring = geom.geometry.coordinates[0];
      if (ring.some(([lon, lat]) => !inRomania(lon, lat))) {
        // A vertex outside Romania means a corrupt source coordinate (e.g. a
        // missing digit) — drop rather than ship a broken polygon.
        oob.push(designator);
        continue;
      }

      seen.add(designator);
      if (geom.warning?.includes('self-intersecting')) selfInt.push(designator);
      const prefix = /^(LR[A-Z]+?)\s/.exec(designator)?.[1] ?? '';
      features.push({
        type: 'Feature',
        properties: {
          designator,
          name: zoneName(block.firstLineRest),
          type: TYPE_BY_PREFIX[prefix] ?? 'UNKNOWN',
          source,
        },
        geometry: geom.geometry,
      });
    }
  }

  const fc = {
    type: 'FeatureCollection',
    _comment:
      'Romanian airspace-zone gazetteer (designator -> geometry) parsed from AIP ' +
      'ENR 5.1 + 5.2 lateral limits. Regenerate with: npm run zones -w packages/parser.',
    features,
  };
  writeFileSync(resolve(ZONES, 'ro-airspace.geojson'), JSON.stringify(fc) + '\n');

  const byType: Record<string, number> = {};
  for (const f of features) {
    const t = (f.properties as any).type;
    byType[t] = (byType[t] ?? 0) + 1;
  }
  console.log(`Wrote ${features.length} zones to ro-airspace.geojson`);
  console.log('by type:', byType);
  if (oob.length) console.log(`⚠ ${oob.length} zones with vertices outside RO bounds:`, oob.slice(0, 8));
  if (selfInt.length) console.log(`⚠ ${selfInt.length} self-intersecting after parse:`, selfInt);
  if (skipped.length) console.log(`⚠ skipped ${skipped.length}:`, skipped.slice(0, 8));
}

main();
