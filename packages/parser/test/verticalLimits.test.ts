import { describe, expect, it } from 'vitest';
import { bandsOverlap, parseVerticalLimit } from '../src/verticalLimits.js';

describe('parseVerticalLimit', () => {
  it('GND => 0 ft', () => {
    const v = parseVerticalLimit('GND');
    expect(v.kind).toBe('GND');
    expect(v.feet).toBe(0);
  });

  it('FL 280 => 28000 ft', () => {
    const v = parseVerticalLimit('FL 280');
    expect(v.kind).toBe('FL');
    expect(v.feet).toBe(28000);
  });

  it('FL 075 (leading zero) => 7500 ft', () => {
    expect(parseVerticalLimit('FL 075').feet).toBe(7500);
  });

  it('3.000 FT AMSL => 3000 ft (Romanian thousands dot)', () => {
    const v = parseVerticalLimit('3.000 FT AMSL');
    expect(v.kind).toBe('FT_AMSL');
    expect(v.feet).toBe(3000);
  });

  it('5.500 FT AMSL => 5500 ft', () => {
    expect(parseVerticalLimit('5.500 FT AMSL').feet).toBe(5500);
  });

  it('1.500 FT AGL => 1500 ft, kind FT_AGL', () => {
    const v = parseVerticalLimit('1.500 FT AGL');
    expect(v.kind).toBe('FT_AGL');
    expect(v.feet).toBe(1500);
  });

  it('run-glued 910 FTAMSL => 910 ft', () => {
    expect(parseVerticalLimit('910 FTAMSL').feet).toBe(910);
  });

  it('unknown text => NaN', () => {
    expect(Number.isNaN(parseVerticalLimit('???').feet)).toBe(true);
  });
});

describe('bandsOverlap (TMA vertical slab vs NOTAM band)', () => {
  // TMA NAPOC slab: 2000 ft – FL185 (18500 ft).
  it('NOTAM spanning the slab overlaps (GND–FL280)', () => {
    expect(bandsOverlap(0, 28000, 2000, 18500)).toBe(true);
  });
  it('NOTAM entirely below the floor does not overlap (GND–1500)', () => {
    expect(bandsOverlap(0, 1500, 2000, 18500)).toBe(false);
  });
  it('NOTAM entirely above the ceiling does not overlap (FL200–FL350)', () => {
    expect(bandsOverlap(20000, 35000, 2000, 18500)).toBe(false);
  });
  it('touching the floor counts as overlap', () => {
    expect(bandsOverlap(0, 2000, 2000, 18500)).toBe(true);
  });
});
