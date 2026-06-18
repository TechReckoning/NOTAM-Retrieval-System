import { describe, expect, it } from 'vitest';
import { allocatedTmas, buildAllocationIndex } from '../src/allocations.js';

const TABLE = {
  _comment: 'ignored',
  TMA_NAPOC: ['LRTRA 30 L', 'LRD 08 C', 'LRTRA 110 A'],
  TMA_BUCURESTI: ['LRTRA 90 G', 'LRD 100 A'],
};

describe('allocation index + lookup', () => {
  const idx = buildAllocationIndex(TABLE);

  it('matches a NOTAM zone ref to its allocated TMA', () => {
    expect(allocatedTmas(['LRTRA 30 L'], idx)).toEqual(['TMA_NAPOC']);
    expect(allocatedTmas(['LRTRA 90 G'], idx)).toEqual(['TMA_BUCURESTI']);
  });

  it('is zero-pad insensitive (LRD 08 C == LRD 8 C)', () => {
    expect(allocatedTmas(['LRD 8 C'], idx)).toEqual(['TMA_NAPOC']);
  });

  it('returns empty for a non-allocated zone', () => {
    expect(allocatedTmas(['LRTRA 99 Z'], idx)).toEqual([]);
  });

  it('handles multiple zone refs and de-duplicates TMAs', () => {
    expect(allocatedTmas(['LRTRA 30 L', 'LRD 08 C'], idx)).toEqual(['TMA_NAPOC']);
  });

  it('skips metadata keys', () => {
    expect(allocatedTmas(['ignored'], idx)).toEqual([]);
  });
});
