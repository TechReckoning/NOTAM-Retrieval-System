import { describe, expect, it } from 'vitest';
import { parseVerticalLimit } from '../src/verticalLimits.js';

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

  it('unknown text => NaN', () => {
    expect(Number.isNaN(parseVerticalLimit('???').feet)).toBe(true);
  });
});
