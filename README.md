# NOTAM Retrieval System

An offline-capable platform that turns a Romanian **BAZA NOTAM** bulletin (a Word
table, e.g. *BNZ 327 / 17.06.2026*) into an **interactive operational picture**:
NOTAM areas drawn on a map alongside a synchronized, filterable, scrollable list.

Built for aviation operational use — clean, scalable, and designed to work without
network connectivity.

> ⚠️ **Operational disclaimer.** This tool is a decision-support aid. It is **not**
> an official source of aeronautical information. Always cross-check against the
> authoritative AIP/NOTAM service before operational use.

## What it does

- **Parses** the bulletin's Word table into a normalized, geo-referenced NOTAM model.
- **Maps** each NOTAM area (polygon / circle), colored by type, with a description
  popup when you click it.
- **Lists** every NOTAM in an enclosed scrollable panel, kept **in sync** with the
  map: click an area → the list scrolls to it; click a list row → the map highlights
  and zooms to it.
- **Filters** by flight level, time window, activity, NOTAM/area type, and a
  user-drawn area on the map.
- **Reviews** every parsed record (with validation flags) before it reaches the map.

## Two kinds of NOTAM, one model

The bulletin contains two structurally different entries:

1. **Inline-coordinate NOTAMs** (e.g. `F6031`, `B7229`, `D1002`) — coordinates are
   printed in the text (DMS polygons, circles `R=6NM`, or named-vertex lists). These
   are mapped directly.
2. **Named-zone NOTAMs** (e.g. `C9517 LRTRA 110 B`, `B7075 LRD 100 A`) — reference
   predefined airspace whose shapes live in the Romanian AIP, **not** in the bulletin.
   These are listed and filterable immediately; their shapes appear once the
   **airspace-zone gazetteer** (`data/zones/ro-airspace.geojson`) is populated.

## Architecture

A client-side, offline-first static web app — no mandatory server. Parsing runs in
the browser (and in a Node CLI for batch use).

```
apps/web/          React + TypeScript + MapLibre GL front end
packages/parser/   Pure, unit-tested bulletin -> Notam[] parser (browser + Node)
packages/cli/      `notam-ingest` CLI (.doc/.docx -> JSON)
data/zones/        Airspace-zone gazetteer (GeoJSON) — populated from the AIP
data/samples/      Demo bulletin (BNZ327.docx) + parsed snapshot (bnz327.json)
basemap/           Offline PMTiles basemap + style (fetched separately)
```

See [`docs/`](docs) and inline module docs for details.

## Live demo

Published via GitHub Pages on every push to `main`:
**https://techreckoning.github.io/NOTAM-Retrieval-System/**

(One-time setup: in the repo, **Settings → Pages → Build and deployment → Source: GitHub Actions**.)

## Quick start

```bash
npm install            # install all workspaces
npm test               # run the parser unit tests
npm run sample         # (re)generate the demo bulletin + JSON snapshot
npm run dev            # launch the web app (Vite dev server)
```

## Command-line ingester

For batch/automation, the same parser is exposed as a CLI:

```bash
# print normalized JSON to stdout
npx tsx packages/cli/src/index.ts data/samples/BNZ327.docx --pretty

# write to a file, resolving named zones against a gazetteer
npx tsx packages/cli/src/index.ts bulletin.docx -o out.json --zones data/zones/ro-airspace.geojson
```

## Offline basemap

The map works offline from a single PMTiles file — see [`basemap/README.md`](basemap/README.md).
By default (no basemap configured) it uses online OpenStreetMap tiles for development.

## Input format

The app ingests **`.docx`** bulletins. If you have the legacy binary **`.doc`**,
open it in Word and *Save As → .docx* (this preserves the table structure that the
parser reads); macOS `textutil` and `soffice --headless --convert-to docx` also work.
The included `data/samples/BNZ327.docx` is a faithful, table-structured demo
transcribed from the real bulletin (see `packages/parser/scripts/build-sample.ts`).

## Status

Core platform complete and verified end-to-end:

- ✅ Parser (`@notam/parser`) — 42 unit tests passing
- ✅ Map + synchronized list with bidirectional selection
- ✅ Filters: flight level, time window, activity, NOTAM type, draw-area
- ✅ Ingest/review screen with per-record validation flags
- ✅ `notam-ingest` CLI
- ⏳ Airspace-zone gazetteer — wired and ready; awaiting the AIP coordinate source
- ⏳ Offline PMTiles basemap — supported in code; basemap file fetched per-machine

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for conventions.

## License

MIT — see [LICENSE](LICENSE).
