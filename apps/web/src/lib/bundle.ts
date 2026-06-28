/**
 * App-side bundle handling: turn the parser's consolidation result into the shape
 * the app consumes — an ACTIVE NOTAM set (everything except superseded/cancelled,
 * each carrying its currency provenance) plus a summary for the Currency panel.
 *
 * Superseded entries (whose replacement is present) and cancelled entries are set
 * ASIDE, not deleted: they are listed in the Currency panel so nothing is hidden,
 * but kept out of the active map/list/overlaps so the operational picture isn't
 * double-counted. Everything else (current / added / replaces / orphan / duplicate)
 * stays active and is badged in place.
 */

import type { BundleDocument, ConsolidatedBundle, EntryState } from '@notam/parser';
import type { LoadedNotam } from './types';

export interface SetAsideEntry {
  id: string;
  state: Extract<EntryState, 'superseded' | 'cancelled'>;
  relatedRef?: string;
  note: string;
}

export interface BundleSummary {
  operationalDate: string | null;
  documents: BundleDocument[];
  /** Bundle-level integrity warnings (orphans, duplicates, base-not-loaded …). */
  warnings: string[];
  /** Count of consolidated entries by currency state. */
  counts: Partial<Record<EntryState, number>>;
  /** Superseded / cancelled entries, surfaced here instead of the active set. */
  setAside: SetAsideEntry[];
  /** Other operational dates present in the upload (multi-date uploads). */
  otherDates: string[];
}

const SET_ASIDE: EntryState[] = ['superseded', 'cancelled'];

/** Build the active NOTAM set + Currency-panel summary from one consolidated bundle. */
export function buildLoadedBundle(
  chosen: ConsolidatedBundle,
  otherDates: string[],
): { notams: LoadedNotam[]; summary: BundleSummary } {
  const notams: LoadedNotam[] = [];
  const setAside: SetAsideEntry[] = [];
  const counts: Partial<Record<EntryState, number>> = {};

  chosen.entries.forEach((e, i) => {
    counts[e.state] = (counts[e.state] ?? 0) + 1;
    if (SET_ASIDE.includes(e.state)) {
      setAside.push({
        id: e.notam.id,
        state: e.state as SetAsideEntry['state'],
        relatedRef: e.relatedRef,
        note: e.notes[0] ?? '',
      });
      return;
    }
    notams.push({
      ...e.notam,
      uid: `${e.notam.id}#${i}`,
      currency: {
        state: e.state,
        relatedRef: e.relatedRef,
        docKind: e.docKind,
        docSequence: e.docSequence,
        notes: e.notes,
      },
    });
  });

  return {
    notams,
    summary: {
      operationalDate: chosen.operationalDate,
      documents: chosen.documents,
      warnings: chosen.warnings,
      counts,
      setAside,
      otherDates,
    },
  };
}
