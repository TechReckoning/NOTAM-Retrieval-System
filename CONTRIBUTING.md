# Contributing

This is an aviation operational tool — correctness and reliability come first.

## Repo layout

```
apps/web/          React + TS + MapLibre front end
packages/parser/   Pure, unit-tested bulletin -> Notam[] parser (browser + Node)
packages/cli/      notam-ingest CLI
data/zones/        Airspace-zone gazetteer (GeoJSON)
data/samples/      Demo bulletin + parsed snapshot
basemap/           Offline PMTiles basemap (fetched per-machine)
```

`packages/parser` is the source of truth for the NOTAM model and **must stay free
of UI and DOM dependencies** so it runs identically in the browser and in Node.

## Workflow

```bash
npm install
npm test                 # parser unit tests (run these before every commit)
npm run sample           # regenerate demo bulletin + JSON snapshot after parser changes
npm run dev              # web app
npm run build            # typecheck + production build
npm run lint
```

## Conventions

- **Parsing logic is pure and unit-tested.** Any change to coordinate, schedule,
  vertical-limit, or classification parsing needs a test transcribed from a real
  bulletin string. Add it to `packages/parser/test`.
- **Small, reviewable commits**, one concern each.
- Keep operational UI text, disclaimers, and units (UTC, feet/FL) stable unless the
  change is the point.
- Coordinates are GeoJSON order **[lon, lat]**; altitudes are normalized to **feet
  AMSL** (`GND` = 0).
- Never silently drop a NOTAM: if a field can't be parsed, surface a `warning` so it
  shows in the ingest review screen rather than disappearing.

## Adding airspace-zone geometry

Named-zone NOTAMs (`LRTRA`/`LRD`/`LRTSA`) resolve via `data/zones/ro-airspace.geojson`.
Each feature needs `properties.designator` matching the canonical form
(`"LRTRA 110 B"`, single-spaced, uppercase) and a `Polygon` geometry. Run the parser
test suite — the gazetteer resolver is covered there.
