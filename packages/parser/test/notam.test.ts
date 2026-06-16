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
