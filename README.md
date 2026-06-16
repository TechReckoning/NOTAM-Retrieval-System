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

## Quick start

```bash
npm install            # install all workspaces
npm test               # run the parser unit tests
npm run sample         # (re)generate the demo bulletin + JSON snapshot
npm run dev            # launch the web app (Vite dev server)
```

## Input format

The app ingests **`.docx`** bulletins. If you have the legacy binary **`.doc`**,
open it in Word and *Save As → .docx* (this preserves the table structure that the
parser reads); macOS `textutil` and `soffice --headless --convert-to docx` also work.
The included `data/samples/BNZ327.docx` is a faithful, table-structured demo
transcribed from the real bulletin (see `packages/parser/scripts/build-sample.ts`).

## Status

Under active development. See the phased plan and `CONTRIBUTING` conventions.
The parser (Phase 1) is complete and unit-tested (42 assertions).

## License

MIT — see [LICENSE](LICENSE).
