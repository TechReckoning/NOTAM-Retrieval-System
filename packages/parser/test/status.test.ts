import { describe, expect, it } from 'vitest';
import { activationStatus } from '../src/status.js';
import type { TimeWindow } from '../src/types.js';

const w = (from: string, to: string): TimeWindow => ({
  fromUTC: from,
  toUTC: to,
  rawFrom: '',
  rawTo: '',
});
const at = (iso: string) => Date.parse(iso);

describe('activationStatus', () => {
  const single = [w('2026-06-17T06:00:00Z', '2026-06-17T16:00:00Z')];

  it('active inside the window', () => {
    expect(activationStatus(single, at('2026-06-17T10:00:00Z'))).toBe('active');
  });
  it('upcoming before the window', () => {
    expect(activationStatus(single, at('2026-06-17T05:00:00Z'))).toBe('upcoming');
  });
  it('expired after the window', () => {
    expect(activationStatus(single, at('2026-06-17T17:00:00Z'))).toBe('expired');
  });
  it('no windows => active (H24 / by NOTAM)', () => {
    expect(activationStatus([], at('2026-06-17T10:00:00Z'))).toBe('active');
  });

  const split = [
    w('2026-06-17T05:00:00Z', '2026-06-17T09:00:00Z'),
    w('2026-06-17T13:00:00Z', '2026-06-17T18:00:00Z'),
  ];
  it('between two windows => upcoming (a later one starts)', () => {
    expect(activationStatus(split, at('2026-06-17T11:00:00Z'))).toBe('upcoming');
  });
  it('after all windows => expired', () => {
    expect(activationStatus(split, at('2026-06-17T19:00:00Z'))).toBe('expired');
  });
});
