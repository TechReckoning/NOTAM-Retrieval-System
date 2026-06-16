/**
 * Basemap style. Online (development): OpenStreetMap raster tiles. Offline
 * (operations): drop a single `.pmtiles` basemap into `basemap/` and point
 * `BASEMAP_PMTILES` at it — the pmtiles protocol is registered below so MapLibre
 * can read it with no tile server. See Phase 6 / README for fetching a basemap.
 */

import maplibregl, { type StyleSpecification } from 'maplibre-gl';
import { Protocol } from 'pmtiles';

/** Set to e.g. 'pmtiles:///basemap/romania.pmtiles' for offline use. */
export const BASEMAP_PMTILES = '';

let registered = false;
export function registerProtocols(): void {
  if (registered) return;
  const protocol = new Protocol();
  maplibregl.addProtocol('pmtiles', protocol.tile);
  registered = true;
}

const OSM_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#0b1020' } },
    { id: 'osm', type: 'raster', source: 'osm' },
  ],
};

const PMTILES_RASTER_STYLE = (url: string): StyleSpecification => ({
  version: 8,
  sources: { base: { type: 'raster', url, tileSize: 256 } },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#0b1020' } },
    { id: 'base', type: 'raster', source: 'base' },
  ],
});

export function getStyle(): StyleSpecification {
  registerProtocols();
  return BASEMAP_PMTILES ? PMTILES_RASTER_STYLE(BASEMAP_PMTILES) : OSM_STYLE;
}

/** Romania-centered initial view. */
export const INITIAL_VIEW = { center: [25.0, 45.9] as [number, number], zoom: 6 };
