/**
 * Top-level bulletin parsing: .docx (or pre-extracted HTML) -> {@link Bulletin}.
 *
 * Runs in both Node (CLI) and the browser (web app upload). mammoth converts the
 * Word document to clean HTML; {@link ./html} turns that into a cell grid and the
 * header text, and {@link assembleNotam} normalizes each data row.
 */

import { classifyBulletinDoc } from './bundle.js';
import { htmlNonTableText, htmlTablesToRows } from './html.js';
import { assembleNotam, detectColumns, type ColumnMap } from './notam.js';
import type { Bulletin, BulletinKind, Notam } from './types.js';

/** Parse the bulletin header (kind, number, validity date, issue date, source office). */
export function parseHeader(text: string): {
  bulletinNr: number | null;
  bulletinDate: string | null;
  issuedDate: string | null;
  source: string | null;
  kind: BulletinKind;
  sequence: number | null;
} {
  const valid = /PENTRU\s+(\d{2})\.(\d{2})\.(\d{4})/i.exec(text);
  const issued = /EMIS[ĂA]?\s*LA\s+(\d{2})\.(\d{2})\.(\d{4})/i.exec(text);
  const iso = (m: RegExpExecArray | null): string | null =>
    m ? `${m[3]}-${m[2]}-${m[1]}` : null;
  // Source office: a short all-caps token on the first non-empty line (e.g. "BNLR").
  const firstLine = text.split(/\r?\n/).find((l) => l.trim().length > 0)?.trim() ?? null;
  const source = firstLine && /^[A-Z]{2,6}$/.test(firstLine) ? firstLine : null;
  const cls = classifyBulletinDoc(text);
  return {
    bulletinNr: cls.baseNr,
    bulletinDate: iso(valid),
    issuedDate: iso(issued),
    source,
    kind: cls.kind,
    sequence: cls.sequence,
  };
}

/**
 * Build a Bulletin from an HTML rendering of the document. Exposed separately so
 * it can be unit-tested without a real .docx.
 */
export function parseHtmlBulletin(html: string): Bulletin {
  const header = parseHeader(htmlNonTableText(html));
  const meta = { bulletinNr: header.bulletinNr, bulletinDate: header.bulletinDate };
  const tables = htmlTablesToRows(html);

  const notams: Notam[] = [];
  for (const table of tables) {
    // Use the first row to detect column roles when it looks like a header.
    const headerRow = table[0] ?? [];
    const looksLikeHeader = headerRow.join(' ').toUpperCase().match(/TIP|DENUMIRE|ACTIVITATE|OBS/);
    const cols: ColumnMap = looksLikeHeader ? detectColumns(headerRow) : detectColumns([]);
    const dataRows = looksLikeHeader ? table.slice(1) : table;
    for (const cells of dataRows) {
      const notam = assembleNotam({ cells }, cols, meta);
      if (notam) notams.push(notam);
    }
  }

  return { ...header, notams };
}

type DocxInput = ArrayBuffer | Uint8Array | Buffer;

/** Parse a .docx (Word) bulletin into a Bulletin. */
export async function parseDocx(input: DocxInput): Promise<Bulletin> {
  // Dynamic import keeps mammoth (large) out of the main bundle until a file
  // is actually parsed — callers that only need types/labels never load it.
  const mammoth = (await import('mammoth')).default;
  const options =
    typeof Buffer !== 'undefined' && input instanceof Buffer
      ? { buffer: input }
      : { arrayBuffer: input instanceof Uint8Array ? input.buffer : (input as ArrayBuffer) };
  const { value: html } = await mammoth.convertToHtml(options as any);
  return parseHtmlBulletin(html);
}
