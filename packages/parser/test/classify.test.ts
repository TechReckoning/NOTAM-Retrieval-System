import { describe, expect, it } from 'vitest';
import {
  classifyActivities,
  classifyAreaType,
  extractContact,
  extractCoordUnits,
  extractNotamId,
  extractZoneRefs,
} from '../src/classify.js';

describe('classifyAreaType', () => {
  it.each([
    ['ZONA TEMP. REZ.', 'TEMP_RESERVED'],
    ['ZONA TEMP. SEG.', 'TEMP_SEGREGATED'],
    ['ZONA PERIC.', 'DANGER'],
    ['ZONA AVERTISM.', 'WARNING'],
    ['something else', 'UNKNOWN'],
    // Real-document quirks: mammoth glues runs, and the bulletin has a typo.
    ['ZONATEMP.REZ.C9528', 'TEMP_RESERVED'],
    ['ZONA TEM. P REZ.', 'TEMP_RESERVED'],
    ['ZONAPERIC.', 'DANGER'],
    ['ZONAAVERTISM.', 'WARNING'],
    ['ZONAAVERTIS.F6021', 'WARNING'],
  ])('%s => %s', (raw, expected) => {
    expect(classifyAreaType(raw)).toBe(expected);
  });
});

describe('classifyActivities', () => {
  it('military training', () => {
    expect(classifyActivities('ZBOR DE ANTR. CU AERON. MIL')).toEqual(['MIL_TRAINING']);
  });
  it('UAV', () => expect(classifyActivities('ZBOR UAV')).toEqual(['UAV']));
  it('sport + parachuting', () => {
    expect(classifyActivities('ZBOR SPORTIV+ LANSARI PARASUTISTI').sort()).toEqual(
      ['PARACHUTING', 'SPORT'].sort(),
    );
  });
});

describe('extractZoneRefs', () => {
  it('extracts multiple sub-zones', () => {
    expect(extractZoneRefs('C9527 LRTRA 28 G LRTRA 28 L LRTRA 28 M')).toEqual([
      'LRTRA 28 G',
      'LRTRA 28 L',
      'LRTRA 28 M',
    ]);
  });
  it('handles LRD and no-space suffix', () => {
    expect(extractZoneRefs('LRD 100 A and LRD 106A')).toEqual(['LRD 100 A', 'LRD 106 A']);
  });
  it('recovers run-glued designators (mammoth)', () => {
    expect(extractZoneRefs('LRTRA 29 GLRTRA 29 LLRTRA 29 M')).toEqual([
      'LRTRA 29 G',
      'LRTRA 29 L',
      'LRTRA 29 M',
    ]);
  });
});

describe('extractCoordUnits', () => {
  it('extracts 4-letter ATC units, not zone designators', () => {
    expect(extractCoordUnits('COORD. IN DIN. DE UNIT. ATC CIV/MIL LRCT+LRBC').sort()).toEqual([
      'LRBC',
      'LRCT',
    ]);
  });
});

describe('extractNotamId', () => {
  it.each([
    ['C9517', 'C9517', 'C'],
    ['F6031', 'F6031', 'F'],
    ['B7229', 'B7229', 'B'],
  ])('%s', (raw, id, series) => {
    expect(extractNotamId(raw)).toEqual({ id, series });
  });
});

describe('extractContact', () => {
  it('captures org and phone', () => {
    const c = extractContact('Aeroclubul României 0372.761.311');
    expect(c).toMatch(/AEROCLUBUL/);
    expect(c).toMatch(/0372/);
  });
});
