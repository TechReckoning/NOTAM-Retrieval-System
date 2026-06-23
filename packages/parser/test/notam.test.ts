import { describe, expect, it } from 'vitest';
import { assembleNotam, DEFAULT_COLUMNS } from '../src/notam.js';

const META = { bulletinNr: 327, bulletinDate: '2026-06-17' };

describe('assembleNotam id fallback (rows with no NOTAM number)', () => {
  it('falls back to the zone designator', () => {
    // cells: [nr, tip, desc, activity, lower, upper, from, to, obs]
    const cells = ['', 'ZONAPERIC.', 'LRD 04 A BOTOSESTI- PAIA', 'ZBOR UAV', 'GND', 'FL 100', 'DD 05.30', 'DD 12.30', ''];
    const n = assembleNotam({ cells }, DEFAULT_COLUMNS, META)!;
    expect(n.id).toBe('LRD 04 A');
    expect(n.series).toBe('');
    expect(n.areaType).toBe('DANGER');
    expect(n.warnings.join(' ')).toMatch(/no NOTAM number/);
  });

  it('falls back to the area name when there is no zone designator', () => {
    const cells = [
      '',
      'ZONAAVERTISM.',
      'Zona TM2 LUNGA, de coordonate:45 57 12N/020 28 58E – 45 59 19N/020 41 00E – 45 50 00N/020 35 00E',
      'ZBOR UAV',
      'GND',
      '910 FTAMSL',
      'DD 15.30',
      'DD 23.59',
      '',
    ];
    const n = assembleNotam({ cells }, DEFAULT_COLUMNS, META)!;
    expect(n.id).toBe('Zona TM2 LUNGA');
    expect(n.areaType).toBe('WARNING');
    expect(n.upper.feet).toBe(910);
    expect(n.geometry?.type).toBe('Polygon');
  });

  it('still prefers a real NOTAM number when present', () => {
    const cells = ['C9517', 'ZONA TEMP. REZ.', 'LRTRA 110 B', 'ZBOR DE ANTR. CU AERON. MIL', 'FL 280', 'FL 660', 'DD 08.00', 'DD 11.00', 'LRCT'];
    const n = assembleNotam({ cells }, DEFAULT_COLUMNS, META)!;
    expect(n.id).toBe('C9517');
    expect(n.series).toBe('C');
  });
});

describe('assembleNotam id from the type cell (merged/shifted rows)', () => {
  it('uses the NOTAM number in the type cell, not a zone designator in the description', () => {
    // Real bug: "Zona C213 SUD" — the number D1001 sits in the type cell, not Nr.
    // The id must be D1001 (the NOTAM number), with the zone name kept in the title.
    const cells = [
      '',
      'ZONA AVERTISM.\nD1001',
      'Zona C213 SUD, de coordonate:\n44 57 00N/027 29 00E – 44 57 00N/026 13 00E – 45 10 00N/026 13 00E – 45 10 00N/027 29 00E—44 57 00N/027 29 00E.',
      'ZBOR AEROFOTO',
      'FL 130',
      'FL 160',
      'DD 04.30',
      'DD 08.00',
      '',
    ];
    const n = assembleNotam({ cells }, DEFAULT_COLUMNS, META)!;
    expect(n.id).toBe('D1001');
    expect(n.series).toBe('D');
    expect(n.title).toContain('C213 SUD');
    expect(n.warnings.join(' ')).not.toMatch(/no NOTAM number/);
  });

  it('works for any series — corridor waypoint in the body does not win over the number', () => {
    // Real bug: id came out "E028" (a waypoint) instead of M3196 (the number).
    const cells = [
      '',
      'TRAIECT\nAVERTISM.\nM3196',
      'Traiect, de coordonate: PCT E028(45 00 00N/025 00 00E) – PCT F021(46 00 00N/026 00 00E).',
      'ZBOR UAV',
      'FL 100',
      'FL 200',
      'DD 05.00',
      'DD 20.00',
      '',
    ];
    const n = assembleNotam({ cells }, DEFAULT_COLUMNS, META)!;
    expect(n.id).toBe('M3196');
    expect(n.series).toBe('M');
  });
});
