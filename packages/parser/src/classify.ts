/**
 * Classification helpers: turn the bulletin's Romanian free text into the
 * normalized enums and identifier fields of the NOTAM model.
 */

import type { Activity, AreaType } from './types.js';

/** Map the "Tip" column text to an AreaType. */
export function classifyAreaType(raw: string): AreaType {
  const t = raw.toUpperCase();
  if (/TEMP\.?\s*SEG/.test(t)) return 'TEMP_SEGREGATED';
  if (/TEMP\.?\s*REZ/.test(t)) return 'TEMP_RESERVED';
  if (/PERIC/.test(t)) return 'DANGER';
  if (/AVERTISM/.test(t)) return 'WARNING';
  return 'UNKNOWN';
}

/** Map the "Activitate" column text to one or more activities. */
export function classifyActivities(raw: string): Activity[] {
  const t = raw.toUpperCase();
  const out: Activity[] = [];
  if (/UAV/.test(t)) out.push('UAV');
  if (/PARASUT|PARAȘUT|PARASUTIST|PARAȘUTIȘT/.test(t)) out.push('PARACHUTING');
  if (/PLANOARE/.test(t)) out.push('GLIDER');
  if (/PARAPANTA|PARAPANTĂ/.test(t)) out.push('PARAGLIDER');
  if (/AEROFOTO/.test(t)) out.push('AERIAL_PHOTO');
  // Military training: "ZBOR DE ANTR. CU AERON. MIL".
  if (/ANTR/.test(t) && /MIL/.test(t)) out.push('MIL_TRAINING');
  if (/SPORTIV/.test(t)) out.push('SPORT');
  if (out.length === 0) out.push('OTHER');
  return Array.from(new Set(out));
}

/** Canonical zone-designator matcher: prefix (LRTRA/LRD/LRTSA/...) + number + optional sub-letter. */
const ZONE_RE = /\bLR[A-Z]{1,4}\s*\d+\s*[A-Z]?\b/g;

/**
 * Extract named airspace-zone designators from the description/title cell,
 * normalized to "PREFIX NUMBER [SUFFIX]" (single-spaced), de-duplicated.
 */
export function extractZoneRefs(text: string): string[] {
  const refs = new Set<string>();
  const matches = text.toUpperCase().match(ZONE_RE) ?? [];
  for (const raw of matches) {
    const m = /^(LR[A-Z]{1,4})\s*(\d+)\s*([A-Z])?$/.exec(raw.replace(/\s+/g, ' ').trim());
    if (!m) continue;
    refs.add(m[3] ? `${m[1]} ${m[2]} ${m[3]}` : `${m[1]} ${m[2]}`);
  }
  return Array.from(refs);
}

/** 4-letter ATC unit ICAO codes from the "Obs." column, e.g. LRCT, LRFT. */
const UNIT_RE = /\bLR[A-Z]{2}\b/g;

export function extractCoordUnits(text: string): string[] {
  const units = new Set<string>();
  for (const u of text.toUpperCase().match(UNIT_RE) ?? []) units.add(u);
  return Array.from(units);
}

/** A NOTAM id like "C9517", "F6031", "B7229". */
const ID_RE = /\b([A-Z])(\d{3,4})\b/;

export function extractNotamId(text: string): { id: string; series: string } | null {
  const m = ID_RE.exec(text.toUpperCase());
  if (!m) return null;
  return { id: `${m[1]}${m[2]}`, series: m[1] };
}

const PHONE_RE = /(?:\+?40|0)[\d./\s]{6,}\d/;
const ORG_KEYWORDS = [
  'AEROCLUBUL ROMÂNIEI',
  'AEROCLUBUL ROMANIEI',
  'OMV-PETROM',
  'OMV',
  'AZLR',
  'HEVECO',
  'AMC',
];

/** Best-effort contact (phone and/or organization) from Obs./description text. */
export function extractContact(text: string): string | undefined {
  const parts: string[] = [];
  const up = text.toUpperCase();
  for (const kw of ORG_KEYWORDS) {
    if (up.includes(kw)) {
      parts.push(kw);
      break;
    }
  }
  const phone = PHONE_RE.exec(text.replace(/\s+/g, ' '));
  if (phone) parts.push(phone[0].trim());
  return parts.length ? parts.join(' · ') : undefined;
}
