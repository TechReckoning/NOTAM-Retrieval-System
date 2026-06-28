import type { AreaType, BulletinKind, EntryState, Notam } from '@notam/parser';

/** Currency provenance of a NOTAM within a consolidated bundle (step 3). */
export interface NotamCurrency {
  state: EntryState;
  /** Replacement (for 'superseded') or original (for 'replaces') NOTAM number. */
  relatedRef?: string;
  docKind: BulletinKind;
  docSequence: number | null;
  notes: string[];
}

/** A NOTAM with a stable unique key (ids can repeat within a bulletin). */
export interface LoadedNotam extends Notam {
  uid: string;
  /** Set when loaded as part of a consolidated bundle; absent for a lone bulletin. */
  currency?: NotamCurrency;
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
