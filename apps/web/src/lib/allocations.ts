/**
 * App-side TMA allocation: maps a NOTAM (by its zone designators) to the TMA(s)
 * the authorities have allocated its restriction to. Drives the persistent
 * "allocated to TMA" badge and the allocation-aware membership in both views.
 */

import { allocatedTmas, buildAllocationIndex, type AllocationTable } from '@notam/parser';
import allocationData from '../../../../data/zones/tma-allocations.json';
import { TMA_AREAS } from './tma';

const index = buildAllocationIndex(allocationData as unknown as AllocationTable);
const nameById = new Map(TMA_AREAS.map((t) => [t.id, t.name]));

export interface AllocatedTma {
  id: string;
  name: string;
}

/** TMAs a NOTAM is allocated to (by zone designator). Empty if none. */
export function tmasForNotam(notam: { zoneRefs: string[] }): AllocatedTma[] {
  return allocatedTmas(notam.zoneRefs, index).map((id) => ({ id, name: nameById.get(id) ?? id }));
}

/** Is the NOTAM allocated to a specific TMA? */
export function isAllocatedTo(notam: { zoneRefs: string[] }, tmaId: string): boolean {
  return allocatedTmas(notam.zoneRefs, index).includes(tmaId);
}
