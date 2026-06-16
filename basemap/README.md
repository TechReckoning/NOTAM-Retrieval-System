# Offline basemap

For operational use without network connectivity, the app reads a single
**PMTiles** basemap file — no tile server required.

## 1. Obtain a Romania basemap (`.pmtiles`)

Pick one:

- **Protomaps prebuilt** — download a region extract from
  <https://maps.protomaps.com/> (draw a box around Romania) and save it here as
  `romania.pmtiles`.
- **Build from an OSM extract** with [planetiler](https://github.com/onthegomap/planetiler):
  ```bash
  # downloads the Romania extract and builds a vector PMTiles
  java -jar planetiler.jar --download --area=romania --output=basemap/romania.pmtiles
  ```
- **Raster** — any raster `.pmtiles` works too (smaller styling effort).

`*.pmtiles` is git-ignored (the file is large); fetch it per-machine.

## 2. Point the app at it

In `apps/web/src/map/style.ts` set:

```ts
export const BASEMAP_PMTILES = 'pmtiles:///basemap/romania.pmtiles';
```

Serve the file at that path (Vite serves `basemap/` if you symlink it into
`apps/web/public/`, or host it behind your own static path). The `pmtiles://`
protocol is already registered in `style.ts`, so MapLibre reads it directly.

When `BASEMAP_PMTILES` is empty (the default), the app uses online OpenStreetMap
raster tiles — convenient for development, but **not** offline-capable.

## Notes

- A vector PMTiles needs a matching MapLibre style; the helper in `style.ts`
  currently wires a **raster** PMTiles source. For vector, replace
  `PMTILES_RASTER_STYLE` with a vector style (e.g. the Protomaps basemaps style).
- NOTAM polygons render on top of whatever basemap is configured, so the app is
  usable even with a minimal/blank basemap.
