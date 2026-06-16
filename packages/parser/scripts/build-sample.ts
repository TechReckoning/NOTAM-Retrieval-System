/**
 * Regenerate the demo JSON snapshot (data/samples/bnz327.json) by parsing the
 * bundled real bulletin data/samples/BNZ327.docx (BAZA NOTAM NR. 327 / 17.06.2026).
 *
 * The app bundles this snapshot as its "Load demo bulletin" dataset, and it
 * doubles as a regression fixture for the full-document parse.
 *
 * Run: npm run sample -w packages/parser
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyGazetteer, parseDocx } from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAMPLES = resolve(__dirname, '../../../data/samples');
const ZONES = resolve(__dirname, '../../../data/zones');

async function main(): Promise<void> {
  const docxPath = resolve(SAMPLES, 'BNZ327.docx');
  const parsed = await parseDocx(readFileSync(docxPath));

  // Resolve named-zone geometry from the gazetteer so the bundled demo ships with
  // LRTRA/LRD shapes already attached.
  const gazetteer = JSON.parse(readFileSync(resolve(ZONES, 'ro-airspace.geojson'), 'utf-8'));
  const bulletin = { ...parsed, notams: applyGazetteer(parsed.notams, gazetteer) };

  const jsonPath = resolve(SAMPLES, 'bnz327.json');
  writeFileSync(jsonPath, JSON.stringify(bulletin, null, 2));

  const withGeom = bulletin.notams.filter((n) => n.geometry).length;
  const pending = bulletin.notams.filter((n) => !n.geometry && n.zoneRefs.length).length;
  const flagged = bulletin.notams.filter((n) => n.warnings.length).length;
  console.log(`Parsed ${docxPath}`);
  console.log(`Wrote ${jsonPath}`);
  console.log(
    `Bulletin ${bulletin.bulletinNr} (${bulletin.bulletinDate}): ${bulletin.notams.length} NOTAMs, ` +
      `${withGeom} with geometry, ${pending} named-zone pending, ${flagged} flagged for review.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
