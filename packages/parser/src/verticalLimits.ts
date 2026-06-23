/**
 * Normalization of vertical limits to feet AMSL, so a single numeric range
 * filter works across GND / flight levels / feet / metres notations.
 *
 * Examples seen in the bulletin: "GND", "FL 280", "FL 075", "3.000 FT AMSL",
 * "5.500 FT AMSL", "2.000 FT AMSL", "200 M AGL" (metres -> feet). Romanian uses
 * "." as a thousands separator.
 */

import type { VerticalLimit } from './types.js';

const FL_RE = /\bFL\s*0*(\d{1,3})\b/i;
const FT_RE = /([\d.,]+)\s*FT/i;
/** Metres, e.g. "200 M AGL", "1.500 M", "200M", "300 MTR". */
const M_RE = /([\d.,]+)\s*M(?:TR|ETERS|ETRI|ETRE)?\b/i;
const M_PER_FT = 0.3048;

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

  // Datum: "AGL" (above ground) vs "AMSL" (above mean sea level). mammoth may glue
  // the suffix ("910 FTAMSL"), so test the whole string.
  const datum: VerticalLimit['kind'] = /AGL/.test(upper) ? 'FT_AGL' : 'FT_AMSL';

  const ft = FT_RE.exec(raw);
  if (ft) {
    // Strip thousands separators ("3.000" -> 3000, "3,000" -> 3000).
    const feet = Number(ft[1].replace(/[.,]/g, ''));
    if (Number.isFinite(feet)) return { kind: datum, raw, feet };
  }

  // Metres -> feet (e.g. "200 M AGL" -> 656 ft AGL). Keep the original for display.
  const m = M_RE.exec(raw);
  if (m) {
    const metres = Number(m[1].replace(/[.,]/g, ''));
    if (Number.isFinite(metres)) {
      const feet = Math.round(metres / M_PER_FT);
      const label = datum === 'FT_AGL' ? 'FT AGL' : 'FT AMSL';
      return { kind: datum, raw: `${feet} ${label}`, feet, original: raw };
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
