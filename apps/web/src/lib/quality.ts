/**
 * Data-quality report: aggregates the parser's per-NOTAM warnings into
 * operator-meaningful categories so the tool is explicit about what it is unsure
 * of. A professional decision-support tool surfaces its own uncertainty.
 */

import type { LoadedNotam } from './types';

export type QualityCategory =
  | 'identification'
  | 'vertical'
  | 'schedule'
  | 'geometry-unresolved'
  | 'geometry-reliability'
  | 'not-placeable'
  | 'other';

export const CATEGORY_ORDER: QualityCategory[] = [
  'not-placeable',
  'geometry-reliability',
  'geometry-unresolved',
  'vertical',
  'schedule',
  'identification',
  'other',
];

export const CATEGORY_LABEL: Record<QualityCategory, string> = {
  'not-placeable': 'Not placeable (no geometry)',
  'geometry-reliability': 'Geometry reliability',
  'geometry-unresolved': 'Geometry unresolved (zone)',
  vertical: 'Vertical limits unparsed',
  schedule: 'Schedule / time',
  identification: 'Identification (no NOTAM number)',
  other: 'Other',
};

/** Map a free-text warning to a category. */
export function categorize(w: string): QualityCategory {
  if (/no NOTAM number/i.test(w)) return 'identification';
  if (/limit unparsed/i.test(w)) return 'vertical';
  if (/interval|mismatch|schedule/i.test(w)) return 'schedule';
  if (/pending|not in gazetteer/i.test(w)) return 'geometry-unresolved';
  if (/self-intersect|outside Romania|cannot form an area|buffer failed/i.test(w))
    return 'geometry-reliability';
  return 'other';
}

export interface QualityItem {
  notam: LoadedNotam;
  categories: QualityCategory[];
  messages: string[];
}

export interface QualityReport {
  total: number;
  withGeometry: number;
  flaggedCount: number;
  notPlaceable: number;
  byCategory: { key: QualityCategory; label: string; count: number }[];
  items: QualityItem[];
}

export function buildQualityReport(notams: LoadedNotam[]): QualityReport {
  const items: QualityItem[] = [];
  for (const n of notams) {
    const messages = [...n.warnings];
    const cats = new Set<QualityCategory>(messages.map(categorize));
    if (!n.geometry) {
      cats.add('not-placeable');
      messages.push('No geometry — cannot be placed on the map');
    }
    if (cats.size === 0) continue;
    items.push({ notam: n, categories: [...cats], messages });
  }

  const counts = new Map<QualityCategory, number>();
  for (const it of items) for (const c of it.categories) counts.set(c, (counts.get(c) ?? 0) + 1);

  return {
    total: notams.length,
    withGeometry: notams.filter((n) => n.geometry).length,
    flaggedCount: items.length,
    notPlaceable: notams.filter((n) => !n.geometry).length,
    byCategory: CATEGORY_ORDER.filter((c) => counts.has(c)).map((c) => ({
      key: c,
      label: CATEGORY_LABEL[c],
      count: counts.get(c)!,
    })),
    items,
  };
}
