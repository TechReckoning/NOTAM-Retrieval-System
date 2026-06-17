/** Shared export helpers (used by the PDF briefing export). */

import { FL_CEILING, FL_FLOOR, type FilterState } from './filter';
import type { LoadedNotam } from './types';

export interface TmaColumn {
  name: string;
  notams: LoadedNotam[];
}

/** Human-readable summary of the active filters, for the export header. */
export function describeFilters(f: FilterState): string {
  const parts: string[] = [];
  if (f.areaTypes.size) parts.push(`type=${[...f.areaTypes].join('/')}`);
  if (f.activities.size) parts.push(`activity=${[...f.activities].join('/')}`);
  if (f.flMin > FL_FLOOR || f.flMax < FL_CEILING)
    parts.push(`FL ${Math.round(f.flMin / 100)}-${Math.round(f.flMax / 100)}`);
  if (f.timeFrom || f.timeTo) parts.push(`time ${f.timeFrom || '…'}-${f.timeTo || '…'}`);
  return parts.length ? parts.join(', ') : 'none';
}
