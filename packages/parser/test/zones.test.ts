import { describe, expect, it } from 'vitest';
import { canonicalDesignator, normalizeDesignator } from '../src/zones.js';

describe('canonicalDesignator', () => {
  it.each([
    ['LRTRA110B', 'LRTRA 110 B'],
    ['LRD04A', 'LRD 04 A'],
    ['LRD103', 'LRD 103'],
    ['LRTSA1', 'LRTSA 1'],
    ['LRTRA2 (IAŞI)', 'LRTRA 2'],
    ['LRD01A BABADAG', null], // trailing words are not a clean designator
  ])('%s => %s', (raw, expected) => {
    expect(canonicalDesignator(raw)).toBe(expected);
  });
});

describe('normalizeDesignator (zero-pad-insensitive)', () => {
  it('matches padded and unpadded forms', () => {
    expect(normalizeDesignator('LRD 04 A')).toBe(normalizeDesignator('LRD 4 A'));
  });
  it('leaves multi-digit numbers intact', () => {
    expect(normalizeDesignator('LRTRA 110 B')).toBe('LRTRA 110 B');
  });
});
