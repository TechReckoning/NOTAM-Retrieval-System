/**
 * Normalized NOTAM data model shared by the parser, CLI, and web app.
 *
 * The model is intentionally geometry-agnostic about *source*: a NOTAM area may
 * come from coordinates printed inline in the bulletin, or be resolved from the
 * airspace-zone gazetteer by its designator, or be unresolved (geometry pending).
 */

import type { Feature, Geometry, Polygon } from 'geojson';

/**
 * Kind of bulletin document, derived from its printed header (never the filename):
 * a base bulletin, or an amendment that supplements (COMPLETARE) or modifies
 * (MODIFICARE) a base.
 */
export type BulletinKind = 'BASE' | 'COMPLETARE' | 'MODIFICARE';

/**
 * An inline supersession marker found inside an entry's text, e.g. "(MODIFICAT
 * P0061)" on a base entry. `ref` is the NOTAM number it names, when present.
 * These are SURFACED for operator review — never used to auto-drop an entry.
 */
export interface EntryMarker {
  kind: 'MODIFICAT' | 'ANULAT' | 'COMPLETAT' | 'INLOCUIT' | 'SUSPENDAT' | 'PRELUNGIT';
  ref: string | null;
  raw: string;
}

/** Type of airspace activation, from the bulletin's "Tip" column. */
export type AreaType =
  | 'TEMP_RESERVED' // ZONA TEMP. REZ.
  | 'TEMP_SEGREGATED' // ZONA TEMP. SEG.
  | 'DANGER' // ZONA PERIC.
  | 'WARNING' // ZONA AVERTISM.
  | 'UNKNOWN';

/** Operational activity taking place inside the area. */
export type Activity =
  | 'MIL_TRAINING' // ZBOR DE ANTR. CU AERON. MIL
  | 'UAV' // ZBOR UAV
  | 'SPORT' // ZBOR SPORTIV
  | 'PARACHUTING' // LANSARI PARASUTISTI
  | 'GLIDER' // ZBOR PLANOARE
  | 'PARAGLIDER' // ZBOR PARAPANTA
  | 'AERIAL_PHOTO' // ZBOR AEROFOTO
  | 'OTHER';

/** A vertical limit, normalized to feet (AMSL) for range filtering. */
export interface VerticalLimit {
  kind: 'GND' | 'FL' | 'FT_AMSL' | 'FT_AGL' | 'UNLIMITED' | 'UNKNOWN';
  /** Display text, e.g. "FL 280", "3.000 FT AMSL", "GND". For metres input this is
   *  the converted feet value (e.g. "656 FT AGL"). */
  raw: string;
  /** Normalized altitude in feet AMSL. GND = 0. NaN if unknown. */
  feet: number;
  /** Original printed text when it was converted (e.g. "200 M AGL"). */
  original?: string;
}

/** An absolute UTC activation window. */
export interface TimeWindow {
  /** ISO 8601 UTC, e.g. "2026-06-17T08:00:00Z". */
  fromUTC: string;
  toUTC: string;
  /** Raw "De la" / "Pana la" text as printed, e.g. "DD 08.00". */
  rawFrom: string;
  rawTo: string;
}

/** How a NOTAM's geometry was obtained. */
export type GeometrySource = 'inline' | 'gazetteer' | 'none';

/** A fully normalized NOTAM record. */
export interface Notam {
  /** NOTAM identifier, e.g. "C9517", "F6031", "B7229". */
  id: string;
  /** Leading series letter, e.g. "C", "F", "B", "D". */
  series: string;
  /** Bulletin number, e.g. 327. */
  bulletinNr: number | null;
  /** Bulletin validity date, ISO "YYYY-MM-DD". */
  bulletinDate: string | null;
  areaType: AreaType;
  /** Raw "Tip" label as printed, e.g. "ZONA TEMP. REZ.". */
  areaTypeRaw: string;
  /** Named airspace-zone designators, e.g. ["LRTRA 110 B"]. May be empty. */
  zoneRefs: string[];
  /** Title / "Denumire" of the area (first line of the description cell). */
  title: string;
  /** Full free-text description (incl. "RESERVED AREA CONTACT ON ..."). */
  description: string;
  activities: Activity[];
  /** Raw "Activitate" text. */
  activityRaw: string;
  lower: VerticalLimit;
  upper: VerticalLimit;
  schedules: TimeWindow[];
  /** ATC coordination unit ICAO codes parsed from "Obs.", e.g. ["LRCT","LRFT"]. */
  coordUnits: string[];
  /** Contact phone / organization, if any. */
  contact?: string;
  /** GeoJSON geometry (Polygon / MultiPolygon) or null when unresolved. */
  geometry: Geometry | null;
  geometrySource: GeometrySource;
  /** For circle-defined areas, the parsed center + radius (metadata). */
  circle?: { centerLon: number; centerLat: number; radiusMeters: number };
  /** Non-fatal parse / validation flags, surfaced in the review UI. */
  warnings: string[];
  /** Inline supersession markers found in the entry text (e.g. "(MODIFICAT P0061)"). */
  markers?: EntryMarker[];
}

/** A parsed bulletin: header metadata + the NOTAM records. */
export interface Bulletin {
  /** Base bulletin number referenced by the header (advisory — may be wrong/typo'd). */
  bulletinNr: number | null;
  /** Operational ("PENTRU") date, ISO "YYYY-MM-DD" — the reliable grouping key. */
  bulletinDate: string | null;
  issuedDate: string | null;
  /** Originating office / FIR header, e.g. "BNLR". */
  source: string | null;
  /** Document kind from its printed header (base vs supplement vs modification). */
  kind: BulletinKind;
  /** n in "COMPLETARE n" / "MODIFICARE n"; null for a base. */
  sequence: number | null;
  notams: Notam[];
}

/**
 * An airspace-zone gazetteer entry: designator -> geometry.
 * Populated from the Romanian AIP source the maintainer supplies later.
 */
export interface ZoneFeatureProps {
  designator: string; // canonical, e.g. "LRTRA 110 B"
  name?: string;
  type?: AreaType;
}
export type ZoneFeature = Feature<Polygon, ZoneFeatureProps>;
