#!/usr/bin/env node
/**
 * notam-ingest — parse a NOTAM bulletin (.docx) into normalized JSON.
 *
 * Usage:
 *   notam-ingest <bulletin.docx> [-o out.json] [--zones gazetteer.geojson] [--pretty]
 *
 * Reuses @notam/parser so the CLI and the web app produce identical output.
 */

import { applyGazetteer, parseDocx, type Bulletin } from '@notam/parser';
import { readFileSync, writeFileSync } from 'node:fs';

interface Args {
  input?: string;
  out?: string;
  zones?: string;
  pretty: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { pretty: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-o' || a === '--out') args.out = argv[++i];
    else if (a === '--zones') args.zones = argv[++i];
    else if (a === '--pretty') args.pretty = true;
    else if (!a.startsWith('-')) args.input = a;
  }
  return args;
}

function usage(): never {
  console.error(
    'Usage: notam-ingest <bulletin.docx> [-o out.json] [--zones gazetteer.geojson] [--pretty]',
  );
  process.exit(2);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input) usage();

  if (args.input.toLowerCase().endsWith('.doc')) {
    console.error(
      'Legacy .doc detected. Re-save it as .docx from Word (or `soffice --headless ' +
        '--convert-to docx`) so the table structure is preserved, then re-run.',
    );
    process.exit(1);
  }

  const buf = readFileSync(args.input);
  let bulletin: Bulletin = await parseDocx(buf);

  if (args.zones) {
    const gazetteer = JSON.parse(readFileSync(args.zones, 'utf-8'));
    bulletin = { ...bulletin, notams: applyGazetteer(bulletin.notams, gazetteer) };
  }

  const json = JSON.stringify(bulletin, null, args.pretty ? 2 : 0);
  if (args.out) {
    writeFileSync(args.out, json);
    const withGeom = bulletin.notams.filter((n) => n.geometry).length;
    console.error(
      `Wrote ${args.out}: bulletin ${bulletin.bulletinNr} (${bulletin.bulletinDate}), ` +
        `${bulletin.notams.length} NOTAMs, ${withGeom} with geometry.`,
    );
  } else {
    process.stdout.write(json + '\n');
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
