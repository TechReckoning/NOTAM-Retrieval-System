/**
 * Activation-window parsing.
 *
 * The bulletin prints times in the "De la (UTC)" / "Pana la (UTC)" columns as
 * "DD HH.MM", where "DD" is a placeholder for the bulletin's day-of-month and
 * HH.MM is UTC. A single NOTAM may carry several intervals (e.g. a morning and
 * an afternoon slot), printed as multiple lines in each cell; we pair the start
 * and end lines by index.
 */

import type { TimeWindow } from './types.js';

interface RawTime {
  raw: string;
  day: number | null; // explicit numeric day if printed, else null (use bulletin day)
  hour: number;
  minute: number;
}

const TIME_RE = /(?:(\d{1,2})\s+)?(?:DD\s*)?(\d{1,2})[.:](\d{2})/g;

/** Extract the time tokens from one cell (one per printed line). */
export function extractTimes(cell: string): RawTime[] {
  const out: RawTime[] = [];
  // Process line by line so the optional leading day binds to the right time.
  for (const line of cell.split(/\r?\n/)) {
    TIME_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = TIME_RE.exec(line)) !== null) {
      const hour = Number(m[2]);
      const minute = Number(m[3]);
      if (hour > 24 || minute > 59) continue;
      out.push({
        raw: m[0].trim(),
        day: m[1] !== undefined ? Number(m[1]) : null,
        hour,
        minute,
      });
    }
  }
  return out;
}

function toIso(year: number, month: number, day: number, hour: number, minute: number): string {
  // month is 1-based here; Date.UTC expects 0-based.
  return new Date(Date.UTC(year, month - 1, day, hour, minute, 0)).toISOString();
}

/**
 * Build activation windows by pairing the start and end cells.
 * `bulletinDate` is ISO "YYYY-MM-DD"; when absent, windows carry raw text only.
 */
export function buildSchedules(
  fromCell: string,
  toCell: string,
  bulletinDate: string | null,
): { schedules: TimeWindow[]; warnings: string[] } {
  const warnings: string[] = [];
  const froms = extractTimes(fromCell);
  const tos = extractTimes(toCell);

  if (froms.length === 0 && tos.length === 0) {
    return { schedules: [], warnings };
  }
  if (froms.length !== tos.length) {
    warnings.push(
      `time intervals mismatch: ${froms.length} start vs ${tos.length} end — paired by index`,
    );
  }

  const n = Math.min(froms.length, tos.length);
  const schedules: TimeWindow[] = [];

  const base = bulletinDate ? bulletinDate.split('-').map(Number) : null;

  for (let i = 0; i < n; i++) {
    const f = froms[i];
    const t = tos[i];
    if (base) {
      const [year, month, defaultDay] = base;
      const fromUTC = toIso(year, month, f.day ?? defaultDay, f.hour, f.minute);
      let toUTC = toIso(year, month, t.day ?? defaultDay, t.hour, t.minute);
      // End at/below start with no explicit later day => crosses midnight.
      if (toUTC <= fromUTC && t.day === null) {
        const d = new Date(toUTC);
        d.setUTCDate(d.getUTCDate() + 1);
        toUTC = d.toISOString();
      }
      schedules.push({ fromUTC, toUTC, rawFrom: f.raw, rawTo: t.raw });
    } else {
      schedules.push({ fromUTC: '', toUTC: '', rawFrom: f.raw, rawTo: t.raw });
    }
  }

  return { schedules, warnings };
}
