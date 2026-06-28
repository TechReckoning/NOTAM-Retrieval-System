/**
 * Bulletin-bundle primitives — classify a document (BASE / COMPLETARE / MODIFICARE)
 * from its PRINTED HEADER, and detect inline supersession markers inside an entry.
 *
 * Strictly content-only: filenames are never consulted (they have been observed to
 * disagree with the document, and even the header's bulletin *number* can be wrong).
 * These feed the consolidation step, which SURFACES relationships for operator review
 * and never auto-resolves or drops anything.
 */

import type { BulletinKind, EntryMarker } from './types.js';

export interface BulletinClass {
  kind: BulletinKind;
  /** n in "COMPLETARE n" / "MODIFICARE n"; null for a base. */
  sequence: number | null;
  /** Base bulletin number named by the header (advisory — may be wrong/typo'd). */
  baseNr: number | null;
}

/** Uppercase + strip diacritics so "MODIFICĂRI"/"ÎNLOCUIT" match reliably. */
const norm = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

/**
 * Classify a bulletin document from its header text (content only — never the
 * filename). "COMPLETARE n LA BAZA NOTAM NR. X" / "MODIFICARE n LA …" → amendment;
 * otherwise a base. `baseNr` is the number printed after "BAZA NOTAM NR.".
 */
export function classifyBulletinDoc(headerText: string): BulletinClass {
  const t = norm(headerText);
  const baseNrMatch = /BAZA\s+NOTAM\s+NR\.?\s*(\d+)/.exec(t);
  const baseNr = baseNrMatch ? Number(baseNrMatch[1]) : null;
  const compl = /COMPLETARE\s+(\d+)\s+LA\b/.exec(t);
  if (compl) return { kind: 'COMPLETARE', sequence: Number(compl[1]), baseNr };
  const modif = /MODIFICARE\s+(\d+)\s+LA\b/.exec(t);
  if (modif) return { kind: 'MODIFICARE', sequence: Number(modif[1]), baseNr };
  return { kind: 'BASE', sequence: null, baseNr };
}

const MARKER_KINDS: EntryMarker['kind'][] = [
  'MODIFICAT',
  'ANULAT',
  'COMPLETAT',
  'INLOCUIT',
  'SUSPENDAT',
  'PRELUNGIT',
];

/**
 * Inline supersession markers inside an entry's text, e.g. "(MODIFICAT P0061)".
 * Returns one per parenthetical that contains a recognized keyword; `ref` is the
 * NOTAM number it names (e.g. "P0061"), or null.
 */
export function extractEntryMarkers(text: string): EntryMarker[] {
  const out: EntryMarker[] = [];
  const re = /\(([^)]*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const innerNorm = norm(m[1]);
    const kind = MARKER_KINDS.find((k) => innerNorm.includes(k));
    if (!kind) continue;
    const ref = /\b([A-Z]\d{3,4})\b/.exec(m[1].toUpperCase())?.[1] ?? null;
    out.push({ kind, ref, raw: m[0].trim() });
  }
  return out;
}
