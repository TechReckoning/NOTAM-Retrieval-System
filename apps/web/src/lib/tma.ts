/**
 * Predefined Terminal Control Area (TMA) boundaries, used as one-click coordinate
 * filters (TMA NAPOC / TMA BUCUREȘTI). Geometries come from data/zones/tma.geojson
 * and are swapped to authoritative AIP ENR 2.1 vertices without code changes.
 */
import type { Polygon } from 'geojson';
// `?raw` keeps the GIS-standard .geojson extension (Vite won't auto-parse it as JSON).
import raw from '../../../../data/zones/tma.geojson?raw';

export interface TmaArea {
  id: string;
  name: string;
  approximate: boolean;
  geometry: Polygon;
}

const parsed = JSON.parse(raw) as { features: any[] };

export const TMA_AREAS: TmaArea[] = parsed.features.map((f: any) => ({
  id: f.properties.id,
  name: f.properties.name,
  approximate: Boolean(f.properties.approximate),
  geometry: f.geometry as Polygon,
}));

export function findTma(id: string): TmaArea | undefined {
  return TMA_AREAS.find((t) => t.id === id);
}
