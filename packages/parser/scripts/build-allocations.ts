/**
 * Build data/zones/tma-allocations.json — the authority-allocated set of
 * restrictions per TMA (AIP / TMA establishing charts). A NOTAM activating an
 * allocated restriction is flagged as relevant to its TMA regardless of whether
 * its geometry intersects the TMA boundary.
 *
 * Source lists are the "Military Exercise and Training Areas" allocation tables
 * for each TMA. Allocation is by EXACT designator. The generator canonicalizes
 * each designator and validates it resolves in the gazetteer, so we can never
 * ship an allocation pointing at a zone we have no coordinates for.
 *
 * Run: npm run allocations -w packages/parser
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalDesignator, normalizeDesignator } from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ZONES = resolve(__dirname, '../../../data/zones');

// Raw allocation lists, exactly as published (OCR fix: LRTRA3OL -> LRTRA30L).
const RAW: Record<string, string> = {
  TMA_NAPOC: `LRD03A LRD03B LRD08A LRD08B LRD08C LRD09A LRD09B LRD10A LRD10B
    LRTRA11G LRTRA11L LRTRA20G LRTRA21C LRTRA21L LRTRA22G LRTRA22L LRTRA23G LRTRA23L
    LRTRA24G LRTRA24L LRTRA25G LRTRA25L LRTRA26L LRTRA27L LRTRA28G LRTRA28L LRTRA29G
    LRTRA29L LRTRA30G LRTRA30L LRTRA31G LRTRA31L LRTRA34G LRTRA34L LRTRA35G LRTRA35L
    LRTRA36G LRTRA36L LRTRA37G LRTRA37L LRTRA110A`,
  TMA_BUCURESTI: `LRTRA90G LRTRA91G LRTRA91L LRTRA92G LRTRA92L LRTRA93G LRTRA94G
    LRD100A LRD100B LRD100C LRTSA61 LRTSA69`,
};

function main(): void {
  // Gazetteer designators, normalized, for validation.
  const fc = JSON.parse(readFileSync(resolve(ZONES, 'ro-airspace.geojson'), 'utf-8'));
  const known = new Set<string>(
    fc.features.map((f: any) => normalizeDesignator(f.properties.designator)),
  );

  const out: Record<string, string[]> = {};
  const missing: string[] = [];
  for (const [tma, raw] of Object.entries(RAW)) {
    const list: string[] = [];
    for (const token of raw.split(/\s+/).filter(Boolean)) {
      const canon = canonicalDesignator(token);
      if (!canon) {
        missing.push(`${tma}: ${token} (unrecognized)`);
        continue;
      }
      if (!known.has(normalizeDesignator(canon))) {
        missing.push(`${tma}: ${canon} (not in gazetteer)`);
        continue;
      }
      list.push(canon);
    }
    out[tma] = list;
  }

  if (missing.length) {
    console.error('Allocation validation FAILED — designators not resolvable:');
    missing.forEach((m) => console.error('  ', m));
    process.exit(1);
  }

  const payload = {
    _comment:
      'Authority-allocated restrictions per TMA (exact designators). A NOTAM activating ' +
      'one of these is relevant to its TMA regardless of geometric intersection. ' +
      'Regenerate with: npm run allocations -w packages/parser.',
    ...out,
  };
  writeFileSync(resolve(ZONES, 'tma-allocations.json'), JSON.stringify(payload, null, 2) + '\n');
  for (const [tma, list] of Object.entries(out)) console.log(`${tma}: ${list.length} restrictions`);
  console.log('Wrote tma-allocations.json');
}

main();
