/**
 * Assemble a normalized {@link Notam} from one bulletin table row.
 *
 * The assembler is deliberately tolerant: the bulletin's column boundaries can
 * be fuzzy (merged cells, an id that lands in the description column, etc.), so
 * each field is read from its expected column but falls back to scanning the
 * whole row where that is safe.
 */

import { extractEntryMarkers } from './bundle.js';
import {
  classifyActivities,
  classifyAreaType,
  extractContact,
  extractCoordUnits,
  extractNotamId,
  extractZoneRefs,
} from './classify.js';
import { parseGeometryFromText } from './coordinates.js';
import { buildSchedules } from './schedule.js';
import type { Notam } from './types.js';
import { parseVerticalLimit } from './verticalLimits.js';

export interface RawRow {
  cells: string[];
}

/** Which 0-based cell index holds which field. */
export interface ColumnMap {
  nr: number;
  tip: number;
  desc: number;
  activity: number;
  lower: number;
  upper: number;
  from: number;
  to: number;
  obs: number;
}

export const DEFAULT_COLUMNS: ColumnMap = {
  nr: 0,
  tip: 1,
  desc: 2,
  activity: 3,
  lower: 4,
  upper: 5,
  from: 6,
  to: 7,
  obs: 8,
};

/** Detect column roles from a header row's text; falls back to DEFAULT_COLUMNS. */
export function detectColumns(headerCells: string[]): ColumnMap {
  const cols = { ...DEFAULT_COLUMNS };
  headerCells.forEach((raw, i) => {
    const t = raw.toUpperCase();
    if (/NR\.?\s*CRT|^NR\b/.test(t)) cols.nr = i;
    else if (/^TIP|\bTIP\b/.test(t)) cols.tip = i;
    else if (/DENUMIRE|DESCRIERE/.test(t)) cols.desc = i;
    else if (/ACTIVITATE/.test(t)) cols.activity = i;
    else if (/LIMITA\s*INF|INF/.test(t)) cols.lower = i;
    else if (/LIMITA\s*SUP|SUP/.test(t)) cols.upper = i;
    else if (/DE\s*LA/.test(t)) cols.from = i;
    else if (/P[ÂA]N[ĂA]\s*LA/.test(t)) cols.to = i;
    else if (/OBS/.test(t)) cols.obs = i;
  });
  return cols;
}

interface BulletinMeta {
  bulletinNr: number | null;
  bulletinDate: string | null;
}

/** Derive a short label from a description's first line (up to the coords/comma). */
function nameLabel(desc: string): string | undefined {
  const first = desc.split(/\r?\n/)[0] ?? '';
  const cut = first.split(/,|de coordonate|R\s*=/i)[0];
  const label = cut.replace(/\s+/g, ' ').trim().slice(0, 40).trim();
  return label || undefined;
}

/**
 * Build a Notam from a row, or return null when the row is clearly not a NOTAM
 * (header, footer, blank). `meta` supplies bulletin number/date for scheduling.
 */
export function assembleNotam(row: RawRow, cols: ColumnMap, meta: BulletinMeta): Notam | null {
  const cell = (i: number): string => (row.cells[i] ?? '').trim();
  const allText = row.cells.join(' \n ');

  const tipCell = cell(cols.tip);
  const descCell = cell(cols.desc);
  const obsCell = cell(cols.obs);

  // The NOTAM number lives in the structured left columns: the Nr column, or the
  // type cell, which in some rows absorbs the number when the row's cells are
  // merged/shifted. Prefer those over the free-text description — there a zone
  // designator ("Zona C213 SUD") or a corridor waypoint can otherwise be mistaken
  // for the number. The description/full-row scan stays as a last resort for rows
  // whose number sits only in the body. Works for any series (letter + 3–4 digits).
  const idInfo =
    extractNotamId(cell(cols.nr)) ??
    extractNotamId(tipCell) ??
    extractNotamId(descCell) ??
    extractNotamId(allText);

  let areaType = classifyAreaType(tipCell);
  let areaTypeRaw = tipCell;
  if (areaType === 'UNKNOWN') {
    // Some rows carry the type label inside the description/Obs text.
    const fromAll = classifyAreaType(allText);
    if (fromAll !== 'UNKNOWN') {
      areaType = fromAll;
      areaTypeRaw = tipCell || allText.match(/ZONA[^\n]*/i)?.[0]?.trim() || '';
    }
  }

  // A genuine NOTAM row has an id, or at least a recognizable area type/geometry.
  const geom = parseGeometryFromText(descCell);
  const hasSignal = idInfo !== null || areaType !== 'UNKNOWN' || geom.geometry !== null;
  if (!hasSignal) return null;

  const warnings: string[] = [];
  const zoneRefs = extractZoneRefs(descCell);

  const lower = parseVerticalLimit(cell(cols.lower));
  const upper = parseVerticalLimit(cell(cols.upper));
  if (lower.kind === 'UNKNOWN' && cell(cols.lower)) warnings.push('lower limit unparsed');
  if (upper.kind === 'UNKNOWN' && cell(cols.upper)) warnings.push('upper limit unparsed');

  const { schedules, warnings: schedWarn } = buildSchedules(
    cell(cols.from),
    cell(cols.to),
    meta.bulletinDate,
  );
  warnings.push(...schedWarn);
  warnings.push(...geom.warnings);

  let geometrySource: Notam['geometrySource'] = 'none';
  if (geom.geometry) geometrySource = 'inline';
  if (!geom.geometry && zoneRefs.length > 0) {
    warnings.push('geometry pending — named zone(s) require gazetteer lookup');
  }

  // Title = first line of description, with the id stripped off.
  const firstLine = descCell.split(/\r?\n/)[0] ?? '';
  const title = idInfo
    ? firstLine.replace(new RegExp(`\\b${idInfo.id}\\b`), '').trim()
    : firstLine.trim();

  // Some bulletin rows carry no NOTAM number — they are identified only by a zone
  // designator (e.g. "LRD 04 A") or an area name. Fall back to that rather than
  // showing "UNKNOWN", and flag it for review.
  let id = idInfo?.id;
  const series = idInfo?.series ?? '';
  if (!id) {
    id = zoneRefs[0] ?? nameLabel(descCell);
    if (id) warnings.push('no NOTAM number in bulletin — labelled by zone/name');
    else id = 'UNKNOWN';
  }

  return {
    id,
    series,
    bulletinNr: meta.bulletinNr,
    bulletinDate: meta.bulletinDate,
    areaType,
    areaTypeRaw,
    zoneRefs,
    title,
    description: descCell,
    activities: classifyActivities(cell(cols.activity)),
    activityRaw: cell(cols.activity),
    lower,
    upper,
    schedules,
    coordUnits: extractCoordUnits(obsCell),
    contact: extractContact(`${obsCell}\n${descCell}`),
    geometry: geom.geometry,
    geometrySource,
    circle: geom.circle,
    warnings,
    markers: extractEntryMarkers(descCell),
  };
}
