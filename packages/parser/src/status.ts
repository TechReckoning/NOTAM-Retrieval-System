/**
 * Activation status of a NOTAM at a given operational time — the basis for the
 * "what's active now / at time T" operational lens.
 */

import type { TimeWindow } from './types.js';

export type ActivationStatus = 'active' | 'upcoming' | 'expired';

/**
 * Classify a NOTAM's activation windows against an operational instant (ms UTC):
 *  - active   — the instant falls inside a window (or there are no windows /
 *               an unparsed window — H24 / "by NOTAM" — treated as active),
 *  - upcoming — not active, but a window starts later,
 *  - expired  — not active and every window has ended.
 */
export function activationStatus(schedules: TimeWindow[], atUtcMs: number): ActivationStatus {
  if (schedules.length === 0) return 'active';
  let anyUpcoming = false;
  for (const s of schedules) {
    const from = s.fromUTC ? Date.parse(s.fromUTC) : NaN;
    const to = s.toUTC ? Date.parse(s.toUTC) : NaN;
    if (Number.isNaN(from) || Number.isNaN(to)) return 'active'; // unparsed -> don't hide
    if (atUtcMs >= from && atUtcMs <= to) return 'active';
    if (from > atUtcMs) anyUpcoming = true;
  }
  return anyUpcoming ? 'upcoming' : 'expired';
}
