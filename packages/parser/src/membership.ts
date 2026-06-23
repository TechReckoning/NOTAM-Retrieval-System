/**
 * TMA membership classification — the single rule for whether a NOTAM is relevant
 * to a Terminal Control Area, and (for AIP-managed zones) how it is surfaced.
 *
 * Two inclusion criteria existed before this module:
 *   (i)  geometric  — the NOTAM intersects the TMA or its 5 NM buffer (laterally)
 *                     AND its altitude band overlaps the TMA's vertical slab (3-D);
 *   (ii) allocated  — the AIP allocates the NOTAM's zone to that TMA (geometry-free).
 *
 * Supplementary rule (this module): a NOTAM that activates an **LRTRA / LRTSA / LRD**
 * zone is an AIP-managed airspace structure. Its TMA membership is decided by the
 * allocation list ALONE — geometry is ignored. An LR zone that merely clips a TMA
 * without being allocated to it is NOT relevant; instead it is surfaced separately
 * as "present but not allocated" so the operator stays aware of it.
 *
 * Corridors (the M-series) route *past* such zones and name them as waypoints, but
 * are not themselves LR zones — they are excluded from the LR rule and stay on the
 * geometric/allocated criteria.
 */

/** Where a NOTAM physically sits relative to a TMA (independent of allocation). */
export type TmaBasis = 'in' | 'buffer' | 'allocated';

export type TmaRelation =
  /** Relevant to the TMA; `basis` is its physical position (or 'allocated' if outside). */
  | { kind: 'relevant'; basis: TmaBasis }
  /** An unallocated LR zone physically in the TMA ('in') or its 5 NM buffer ('buffer') —
   *  NOT relevant, surfaced for awareness only. */
  | { kind: 'lr-present'; where: 'in' | 'buffer' }
  /** Not related to this TMA. */
  | { kind: 'none' };

const LR_ZONE_RE = /^(LRTRA|LRTSA|LRD)\b/;

/**
 * Is this NOTAM the activation of an AIP-managed LRTRA / LRTSA / LRD zone?
 * True when it carries such a zone designator AND is not an M-series corridor.
 */
export function isLrManagedZone(n: { series: string; zoneRefs: string[] }): boolean {
  if (n.series === 'M') return false;
  return n.zoneRefs.some((r) => LR_ZONE_RE.test(r.toUpperCase()));
}

/**
 * Decide a NOTAM's relation to one TMA from precomputed facts.
 * `inBuffer` / `inTrue` are the 3-D geometric facts (lateral ∩ AND vertical overlap);
 * `inTrue` implies `inBuffer` (the true boundary lies inside the buffer).
 */
export function classifyTmaMembership(facts: {
  isLr: boolean;
  allocated: boolean;
  inBuffer: boolean;
  inTrue: boolean;
}): TmaRelation {
  const { isLr, allocated, inBuffer, inTrue } = facts;
  const basis: TmaBasis = inTrue ? 'in' : inBuffer ? 'buffer' : 'allocated';

  if (isLr) {
    // AIP-managed zone: allocation decides relevance; geometry is ignored.
    if (allocated) return { kind: 'relevant', basis };
    // Not allocated but physically present → awareness only.
    if (inBuffer) return { kind: 'lr-present', where: inTrue ? 'in' : 'buffer' };
    return { kind: 'none' };
  }

  // Everything else: geometric OR allocated.
  if (inBuffer || allocated) return { kind: 'relevant', basis };
  return { kind: 'none' };
}
