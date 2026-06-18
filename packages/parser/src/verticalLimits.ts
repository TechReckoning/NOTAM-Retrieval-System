/**
 * Normalization of vertical limits to feet AMSL, so a single numeric range
 * filter works across GND / flight levels / feet-AMSL notations.
 *
 * Examples seen in the bulletin: "GND", "FL 280", "FL 075", "3.000 FT AMSL",
 * "5.500 FT AMSL", "2.000 FT AMSL". Romanian uses "." as a thousands separator.
 */

import type { VerticalLimit } from './types.js';

const FL_RE = /\bFL\s*0*(\d{1,3})\b/i;
const FT_RE = /([\d.,]+)\s*FT/i;

export function parseVerticalLimit(rawInput: string): VerticalLimit {
  const raw = rawInput.trim();
  const upper = raw.toUpperCase();

  if (/\bGND\b|\bSFC\b/.test(upper)) {
    return { kind: 'GND', raw, feet: 0 };
  }
  if (/\bUNL\b|UNLIMITED/.test(upper)) {
    return { kind: 'UNLIMITED', raw, feet: Number.POSITIVE_INFINITY };
  }

  const fl = FL_RE.exec(raw);
  if (fl) {
    return { kind: 'FL', raw, feet: Number(fl[1]) * 100 };
  }

  const ft = FT_RE.exec(raw);
  if (ft) {
    // Strip thousands separators ("3.000" -> 3000, "3,000" -> 3000).
    const digits = ft[1].replace(/[.,]/g, '');
    const feet = Number(digits);
    if (Number.isFinite(feet)) {
      // "FT AGL" (above ground) vs "FT AMSL" (above mean sea level). mammoth may
      // glue the suffix ("910 FTAMSL"), so test the whole string.
      const kind = /AGL/.test(upper) ? 'FT_AGL' : 'FT_AMSL';
      return { kind, raw, feet };
    }
  }

  return { kind: 'UNKNOWN', raw, feet: Number.NaN };
}

/**
 * Do two altitude bands [aLow,aHigh] and [bLow,bHigh] (feet) overlap? Used to test
 * whether a NOTAM's vertical extent intersects a TMA's floor/ceiling slab.
 * Inclusive at the edges (touching counts as overlap).
 */
export function bandsOverlap(aLow: number, aHigh: number, bLow: number, bHigh: number): boolean {
  return aLow <= bHigh && aHigh >= bLow;
}
