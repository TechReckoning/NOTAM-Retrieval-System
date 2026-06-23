import { describe, expect, it } from 'vitest';
import { classifyTmaMembership, isLrManagedZone } from '../src/membership.js';

describe('isLrManagedZone', () => {
  it('LRTRA zone NOTAM is LR-managed', () => {
    expect(isLrManagedZone({ series: 'C', zoneRefs: ['LRTRA 21 C'] })).toBe(true);
  });
  it('LRD zone NOTAM is LR-managed', () => {
    expect(isLrManagedZone({ series: 'B', zoneRefs: ['LRD 100 B'] })).toBe(true);
  });
  it('LRTSA zone NOTAM is LR-managed', () => {
    expect(isLrManagedZone({ series: 'F', zoneRefs: ['LRTSA 2'] })).toBe(true);
  });
  it('ad-hoc coordinate zone (no LR designator) is NOT LR-managed', () => {
    expect(isLrManagedZone({ series: 'C', zoneRefs: [] })).toBe(false);
    expect(isLrManagedZone({ series: 'D', zoneRefs: ['ZONA 7 ALPHA'] as string[] })).toBe(false);
  });
  it('M-series corridor naming LRTRA waypoints is NOT LR-managed', () => {
    expect(
      isLrManagedZone({ series: 'M', zoneRefs: ['LRTRA 73', 'LRD 38 A'] }),
    ).toBe(false);
  });
  it('does not misfire on a navaid-like prefix without a zone number space', () => {
    // zoneRefs are canonicalized "PREFIX NUMBER [SUFFIX]"; a bare token won't match.
    expect(isLrManagedZone({ series: 'C', zoneRefs: ['LRDV'] })).toBe(false);
  });
});

describe('classifyTmaMembership', () => {
  // --- LR-managed zones: allocation decides relevance, geometry ignored ---
  it('LR + allocated + inside → relevant, basis "in"', () => {
    expect(
      classifyTmaMembership({ isLr: true, allocated: true, inBuffer: true, inTrue: true }),
    ).toEqual({ kind: 'relevant', basis: 'in' });
  });
  it('LR + allocated + outside → relevant, basis "allocated"', () => {
    expect(
      classifyTmaMembership({ isLr: true, allocated: true, inBuffer: false, inTrue: false }),
    ).toEqual({ kind: 'relevant', basis: 'allocated' });
  });
  it('LR + NOT allocated + inside true boundary → lr-present "in" (awareness only)', () => {
    expect(
      classifyTmaMembership({ isLr: true, allocated: false, inBuffer: true, inTrue: true }),
    ).toEqual({ kind: 'lr-present', where: 'in' });
  });
  it('LR + NOT allocated + only in buffer → lr-present "buffer"', () => {
    expect(
      classifyTmaMembership({ isLr: true, allocated: false, inBuffer: true, inTrue: false }),
    ).toEqual({ kind: 'lr-present', where: 'buffer' });
  });
  it('LR + NOT allocated + not present → none', () => {
    expect(
      classifyTmaMembership({ isLr: true, allocated: false, inBuffer: false, inTrue: false }),
    ).toEqual({ kind: 'none' });
  });

  // --- non-LR zones: geometric OR allocated (unchanged behaviour) ---
  it('non-LR + geometric (in buffer) → relevant', () => {
    expect(
      classifyTmaMembership({ isLr: false, allocated: false, inBuffer: true, inTrue: false }),
    ).toEqual({ kind: 'relevant', basis: 'buffer' });
  });
  it('non-LR + allocated only → relevant, basis "allocated"', () => {
    expect(
      classifyTmaMembership({ isLr: false, allocated: true, inBuffer: false, inTrue: false }),
    ).toEqual({ kind: 'relevant', basis: 'allocated' });
  });
  it('non-LR + neither → none', () => {
    expect(
      classifyTmaMembership({ isLr: false, allocated: false, inBuffer: false, inTrue: false }),
    ).toEqual({ kind: 'none' });
  });
});
