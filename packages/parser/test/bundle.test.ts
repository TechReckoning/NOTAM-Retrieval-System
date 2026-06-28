import { describe, expect, it } from 'vitest';
import { classifyBulletinDoc, extractEntryMarkers } from '../src/bundle.js';

describe('classifyBulletinDoc (content-only, never the filename)', () => {
  it('classifies a base bulletin', () => {
    expect(classifyBulletinDoc('BNLR\nBAZA NOTAM NR. 338 PENTRU 22.06.2026')).toEqual({
      kind: 'BASE',
      sequence: null,
      baseNr: 338,
    });
  });

  it('classifies a COMPLETARE with its sequence and base number', () => {
    expect(
      classifyBulletinDoc('COMPLETARE 1 LA BAZA NOTAM NR.338 PENTRU 22.06.2026'),
    ).toEqual({ kind: 'COMPLETARE', sequence: 1, baseNr: 338 });
  });

  it('classifies a MODIFICARE', () => {
    expect(classifyBulletinDoc('MODIFICARE 1 LA BAZA NOTAM NR. 313 PENTRU 18.06.2026')).toEqual({
      kind: 'MODIFICARE',
      sequence: 1,
      baseNr: 313,
    });
  });

  it('reads the base number verbatim even when it is the wrong one (313 vs filename 317)', () => {
    // Real case: the file is "MODIFICARE 1 LA BNP 317" but the header says 313.
    // We capture what the document prints; correctness is judged later, by the operator.
    expect(classifyBulletinDoc('MODIFICARE 1 LA BAZA NOTAM NR. 313').baseNr).toBe(313);
  });

  it('handles higher completare numbers', () => {
    expect(classifyBulletinDoc('COMPLETARE 3 LA BAZA NOTAM NR. 317').sequence).toBe(3);
  });
});

describe('extractEntryMarkers (inline supersession markers)', () => {
  it('extracts a MODIFICAT marker with its referenced NOTAM number', () => {
    expect(extractEntryMarkers('LRTRA 40  (MODIFICAT P0061)')).toEqual([
      { kind: 'MODIFICAT', ref: 'P0061', raw: '(MODIFICAT P0061)' },
    ]);
  });

  it('extracts a cancellation marker with no reference', () => {
    expect(extractEntryMarkers('Zona X (ANULAT)')).toEqual([
      { kind: 'ANULAT', ref: null, raw: '(ANULAT)' },
    ]);
  });

  it('matches despite diacritics (ÎNLOCUIT)', () => {
    const out = extractEntryMarkers('Zona Y (ÎNLOCUIT B7100)');
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('INLOCUIT');
    expect(out[0].ref).toBe('B7100');
  });

  it('returns [] for ordinary parentheticals (coordinates, radius)', () => {
    expect(extractEntryMarkers('Poligon BOBOC, de coordonate: 45 13 28N/026 57 05E, R = 3 KM.')).toEqual(
      [],
    );
    expect(extractEntryMarkers('Zona CLINCENI (LRD 100 B)')).toEqual([]);
  });
});
