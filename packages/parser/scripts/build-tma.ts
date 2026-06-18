/**
 * Generate data/zones/tma.geojson from the authoritative AIP ENR 2.1 lateral
 * limits of TMA NAPOC and TMA BUCUREȘTI. Coordinates are parsed with the same
 * tested DMS parser the rest of the app uses (no hand arithmetic).
 *
 * Run: npm run tma -w packages/parser
 */

import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractCoords } from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../../../data/zones/tma.geojson');

// Source: AIP Romania ENR 2.1 (lateral + vertical limits).
// Vertical: floorFt/ceilingFt in feet AMSL (FL185 = 18 500 ft); labels for display.
interface TmaDef {
  id: string;
  name: string;
  raw: string;
  floorFt: number;
  ceilingFt: number;
  floorLabel: string;
  ceilingLabel: string;
}
const TMAS: TmaDef[] = [
  {
    id: 'TMA_NAPOC',
    name: 'TMA NAPOC',
    raw: `471756N 0240259E - 462812N 0250000E - 453800N 0250000E - 453800N 0233300E -
          460015N 0231146E - 465945N 0225115E - 471501N 0230809E - 471756N 0240259E`,
    floorFt: 2000,
    ceilingFt: 18500,
    floorLabel: '2000 ft',
    ceilingLabel: 'FL185',
  },
  {
    id: 'TMA_BUCURESTI',
    name: 'TMA BUCUREȘTI',
    raw: `450434N 0251130E - 450434N 0262715E - 445323N 0265801E - 442000N 0270000E -
          440000N 0254000E - 440447N 0251511E - 443737N 0250858E - 450434N 0251130E`,
    floorFt: 1000,
    ceilingFt: 18500,
    floorLabel: '1000 ft',
    ceilingLabel: 'FL185',
  },
];

/** The published format separates lat/lon by a space; the parser expects "/". */
function normalize(raw: string): string {
  return raw.replace(/([NS])\s+(\d)/g, '$1/$2');
}

function ring(raw: string): number[][] {
  const coords = extractCoords(normalize(raw));
  const r = coords.map((c) => [Number(c.lon.toFixed(6)), Number(c.lat.toFixed(6))]);
  const first = r[0];
  const last = r[r.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) r.push(first);
  return r;
}

const fc = {
  type: 'FeatureCollection',
  _comment:
    'TMA boundaries from AIP Romania ENR 2.1 lateral limits, parsed from published DMS. ' +
    'Used as predefined coordinate filters. Regenerate with: npm run tma -w packages/parser.',
  features: TMAS.map((t) => ({
    type: 'Feature',
    properties: {
      id: t.id,
      name: t.name,
      approximate: false,
      source: 'AIP ENR 2.1',
      floorFt: t.floorFt,
      ceilingFt: t.ceilingFt,
      floorLabel: t.floorLabel,
      ceilingLabel: t.ceilingLabel,
    },
    geometry: { type: 'Polygon', coordinates: [ring(t.raw)] },
  })),
};

writeFileSync(OUT, JSON.stringify(fc, null, 2) + '\n');

for (const f of fc.features) {
  const r = f.geometry.coordinates[0];
  const lons = r.map((p) => p[0]);
  const lats = r.map((p) => p[1]);
  console.log(
    `${f.properties.name}: ${r.length - 1} vertices, ` +
      `lon ${Math.min(...lons).toFixed(3)}–${Math.max(...lons).toFixed(3)}, ` +
      `lat ${Math.min(...lats).toFixed(3)}–${Math.max(...lats).toFixed(3)}`,
  );
}
console.log(`Wrote ${OUT}`);
