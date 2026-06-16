/**
 * Build a faithful, table-structured demo bulletin (.docx) from NOTAM rows
 * transcribed out of the real "BAZA NOTAM NR. 327 / 17.06.2026" document, then
 * run it through the parser to emit the JSON snapshot the web app ships with.
 *
 * Why generate the .docx: macOS `textutil` flattens the original .doc table to
 * loose paragraphs (no <w:tbl>), which the parser cannot read. A Word "Save As
 * .docx" of the original would parse directly; this script reproduces an
 * equivalent, properly-tabled .docx for demo/testing without Word/LibreOffice.
 *
 * Run: npm run sample -w packages/parser
 */

import { Document, Packer, Paragraph, Table, TableCell, TableRow, WidthType } from 'docx';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDocx } from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAMPLES = resolve(__dirname, '../../../data/samples');

const HEADER = [
  'Nr. crt.',
  'Tip',
  'Denumire, Descriere',
  'Activitate',
  'Limita inf',
  'Limita sup',
  'De la UTC',
  'Pana la UTC',
  'Obs.',
];

// [id, tip, denumire/descriere, activitate, inf, sup, de la, pana la, obs]
const ROWS: string[][] = [
  // Named-zone military NOTAMs (no inline coordinates -> geometry pending).
  [
    'C9517', 'ZONA TEMP. REZ.', 'LRTRA 110 B', 'ZBOR DE ANTR. CU AERON. MIL',
    'FL 280', 'FL 660', 'DD 08.00', 'DD 11.00', 'COORD. IN DIN. DE UNIT. ATC CIV/MIL LRCT',
  ],
  [
    'C9519', 'ZONA TEMP. REZ.', 'LRTRA 20 G', 'ZBOR DE ANTR. CU AERON. MIL',
    'GND', '3.000 FT AMSL', 'DD 00.00', 'DD 23.59',
    'COORD. IN DIN. DE UNIT. ATC CIV/MIL LRCT+LRFT+LROP+LRBO',
  ],
  [
    'C9527', 'ZONA TEMP. REZ.', 'LRTRA 28 G LRTRA 28 L LRTRA 28 M',
    'ZBOR DE ANTR. CU AERON. MIL', 'GND', 'FL 280', 'DD 06.00', 'DD 16.00', '',
  ],
  // Inline-coordinate NOTAMs (polygons / circles / named-vertex).
  [
    'F6031', 'ZONA AVERTISM.',
    'Zona CORIDOR SAVARSIN-DEVA POLIGON 3, de coordonate: 45 52 25N/022 53 59E – 45 53 25N/022 55 58E – 45 58 34N/022 49 01E – 45 56 54N/022 48 31E.',
    'ZBOR UAV', 'GND', '1.200 FT AMSL', 'DD 06.00', 'DD 16.00', '',
  ],
  [
    'F6032', 'ZONA TEMP. SEG.',
    'ZONA 6 OMV VATA ALUNISU, de coordonate: 44 45 45N/024 30 01E – 44 48 50N/024 41 41E – 44 51 22N/024 35 03E – 44 53 58N/024 37 32E – 44 49 01N/024 53 01E – 44 41 26N/024 39 32E – 44 39 59N/024 35 51E.',
    'ZBOR UAV', 'GND', '3.940 FT AMSL', 'DD 06.00', 'DD 16.00', 'OMV-PETROM 0732.999.330',
  ],
  [
    'F6034', 'ZONA TEMP. SEG.',
    'LRTSA 2 IANCA, de coordonate: 45 13 12N/027 25 38E – 45 11 55N/027 28 38E – 45 11 07N/027 30 29E – 45 09 54N/027 29 29E – 45 05 56N/027 26 13E – 45 07 53N/027 21 17E. RESERVED AREA CONTACT ON FREQ. 119.080 OR PHONE +40733.102.773 ACTIVITY UAV.',
    'ZBOR UAV', '5.000 FT AMSL', 'FL 130', 'DD 09.00', 'DD 13.00', '',
  ],
  [
    'B7076', 'ZONA PERIC.',
    'Zona CLINCENI (LRD 100 B), de coordonate: 44 18 00N/025 56 00E, R=6NM. RESERVED AREA CONTACT ON 128.305 MHz OR PHONE +40736.663.797. SPORTS ACTIVITY OF AIRCRAFT AND PARACHUTE JUMPING.',
    'ZBOR SPORTIV + LANSARI PARASUTISTI', '2.000 FT AMSL', 'FL 060', 'DD 06.30', 'DD 18.00',
    'Aeroclubul României 0372.761.311',
  ],
  [
    'B7229', 'ZONA PERIC.',
    'Zona BRAȘOV (LRD 104), de coordonate: 45 47 17N/025 39 51E - 45 44 38N/025 45 22E - 45 39 12N/025 39 53E - 45 42 04N/025 34 21E. RESERVED AREA CONTACT ON 135.190 MHz. SPORTS ACTIVITY OF AIRCRAFT AND GLIDERS.',
    'ZBOR SPORTIV + ZBOR PLANOARE', '4.000 FT AMSL', 'FL 080', 'DD 05.00', 'DD 18.00', '',
  ],
  [
    'B7232', 'ZONA PERIC.',
    'ZONA 1 CLUJ, de coordonate: 46 47 25N/023 45 02E – 46 47 45N/023 54 04E – 46 44 44N/023 55 14E – 46 43 46N/023 49 31E – 46 42 09N/023 39 34E – 46 43 04N/023 37 58E – 46 45 39N/023 37 56E – 46 46 43N/023 39 58E - 46 46 58N/023 42 52E. AERIAL SPORTING ACTIVITIES AND AEROBATICS, TRAINING FLT.',
    'ZBOR SPORTIV', 'GND', 'FL 075', 'DD 05.00', 'DD 18.00', '',
  ],
  [
    'B7233', 'ZONA PERIC.',
    'ZONA TG.MURES, de coordonate: 46 32 00N/024 31 45E, R = 5 KM. DANGER AREA ACTIVATED, CONTACT ON 119.080 MHz. SPORTS ACTIVITY OF AIRCRAFTS AND PARACHUTE JUMPING.',
    'ZBOR SPORTIV + LANSARI PARASUTISTI', 'GND', 'FL 080', 'DD 06.00', 'DD 18.00', '',
  ],
  [
    'D1002', 'ZONA AVERTISM.',
    'Zona 2 IGNIS-BAIA MARE (AZLR), de coordonate: 47 52 57N/023 27 35E - 47 41 21N/023 27 49E - 47 39 39N/023 47 42E - 474610N/023 45 13E - 47 51 23N/023 37 47E - 47 52 57N/023 27 35E.',
    'ZBOR PARAPANTA', 'GND', 'FL 055', 'DD 09.00', 'DD 17.00', 'AZLR 0751.385.251',
  ],
  [
    'D1006', 'ZONA AVERTISM.',
    'Zona 7 ALPHA, de coordonate: 44 50 37N/024 04 29E – 44 50 18N/024 50 52E – 45 11 56N/024 42 38E – 44 59 58N/023 59 03E.',
    'ZBOR AEROFOTO', 'FL 180', 'FL 190', 'DD 05.30', 'DD 15.30', 'HEVECO 0726.336.537',
  ],
  [
    'D1007', 'ZONA AVERTISM.',
    'Zona 8 CHARLIE, de coordonate: 45 31 35N/026 45 02E – 44 55 58N/026 01 36E – 44 50 46N/026 06 22E – 45 21 59N/026 56 30E.',
    'ZBOR AEROFOTO', 'FL 180', 'FL 190', 'DD 11.30', 'DD 15.30', '',
  ],
  [
    'D1008', 'ZONA AVERTISM.',
    'Zona 9 VIDRA, de coordonate: 44 31 06N/026 14 50E – 44 18 13N/025 56 47E – 44 11 35N/026 06 10E – 44 24 15N/026 23 44E.',
    'ZBOR AEROFOTO', 'FL 180', 'FL 190', 'DD 08.00', 'DD 11.30', '',
  ],
];

function cell(text: string): TableCell {
  const paragraphs = (text === '' ? [''] : text.split('\n')).map((t) => new Paragraph(t));
  return new TableCell({ children: paragraphs, width: { size: 1111, type: WidthType.DXA } });
}

function tableRow(cells: string[]): TableRow {
  return new TableRow({ children: cells.map(cell) });
}

async function main(): Promise<void> {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph('BNLR'),
          new Paragraph('BAZA NOTAM NR. 327 PENTRU 17.06.2026'),
          new Paragraph('EMISĂ LA 16.06.2026'),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [tableRow(HEADER), ...ROWS.map(tableRow)],
          }),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const docxPath = resolve(SAMPLES, 'BNZ327.docx');
  writeFileSync(docxPath, buffer);

  // Parse it back to validate the docx adapter and emit the JSON snapshot.
  const bulletin = await parseDocx(buffer);
  const jsonPath = resolve(SAMPLES, 'bnz327.json');
  writeFileSync(jsonPath, JSON.stringify(bulletin, null, 2));

  const withGeom = bulletin.notams.filter((n) => n.geometry).length;
  const pending = bulletin.notams.filter((n) => !n.geometry && n.zoneRefs.length).length;
  console.log(`Wrote ${docxPath}`);
  console.log(`Wrote ${jsonPath}`);
  console.log(
    `Bulletin ${bulletin.bulletinNr} (${bulletin.bulletinDate}): ${bulletin.notams.length} NOTAMs, ` +
      `${withGeom} with geometry, ${pending} pending gazetteer.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
