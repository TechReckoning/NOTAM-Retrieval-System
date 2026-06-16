import type { AreaType, Notam } from '@notam/parser';

/** A NOTAM with a stable unique key (ids can repeat within a bulletin). */
export interface LoadedNotam extends Notam {
  uid: string;
}

/** Assign stable UIDs to a freshly parsed NOTAM set. */
export function withUids(notams: Notam[]): LoadedNotam[] {
  return notams.map((n, i) => ({ ...n, uid: `${n.id}#${i}` }));
}

export const AREA_TYPES: AreaType[] = [
  'TEMP_RESERVED',
  'TEMP_SEGREGATED',
  'DANGER',
  'WARNING',
  'UNKNOWN',
];
