import { applyGazetteer, type Notam } from '@notam/parser';
import type { FeatureCollection, Polygon } from 'geojson';

/**
 * Resolve named-zone (LRTRA/LRD/…) geometry for freshly uploaded bulletins using
 * the airspace gazetteer. The gazetteer (~0.5 MB) is lazily imported so it only
 * loads when the user uploads a .docx — the bundled demo is already resolved.
 */
let cache: FeatureCollection<Polygon, { designator: string }> | null = null;

export async function resolveZones(notams: Notam[]): Promise<Notam[]> {
  if (!cache) {
    const raw = (await import('../../../../data/zones/ro-airspace.geojson?raw')).default;
    cache = JSON.parse(raw) as FeatureCollection<Polygon, { designator: string }>;
  }
  return applyGazetteer(notams, cache);
}
