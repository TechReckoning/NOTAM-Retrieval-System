/**
 * CSV export for List View Mode — the TMA NAPOC + TMA BUCUREȘTI lists, reflecting
 * the currently applied filters. Generated entirely client-side (works offline).
 */

import { ACTIVITY_LABELS, AREA_TYPE_LABELS } from '@notam/parser';
import { FL_CEILING, FL_FLOOR, type FilterState } from './filter';
import type { LoadedNotam } from './types';

export interface TmaColumn {
  name: string;
  notams: LoadedNotam[];
}

interface Meta {
  bulletinNr: number | null;
  bulletinDate: string | null;
  source: string | null;
}

const HEADERS = [
  'TMA',
  'NOTAM',
  'Type',
  'Activity',
  'Lower',
  'Upper',
  'Active (UTC)',
  'Coordination',
  'Contact',
  'Geometry',
  'Warnings',
];

/** Format one schedule window from ISO to "YYYY-MM-DD HH:MM" (falls back to raw). */
function fmtWindow(s: LoadedNotam['schedules'][number]): string {
  if (!s.fromUTC || !s.toUTC) return `${s.rawFrom}–${s.rawTo}`;
  const t = (iso: string) => iso.slice(0, 16).replace('T', ' ');
  return `${t(s.fromUTC)}–${t(s.toUTC)}Z`;
}

function notamRow(tma: string, n: LoadedNotam): string[] {
  return [
    tma,
    n.id,
    AREA_TYPE_LABELS[n.areaType] ?? n.areaType,
    n.activities.map((a) => ACTIVITY_LABELS[a] ?? a).join('; '),
    n.lower.raw,
    n.upper.raw,
    n.schedules.map(fmtWindow).join(' ; '),
    n.coordUnits.join(' '),
    n.contact ?? '',
    n.geometrySource,
    n.warnings.join(' | '),
  ];
}

/** Human-readable summary of the active filters, for the export preamble. */
export function describeFilters(f: FilterState): string {
  const parts: string[] = [];
  if (f.areaTypes.size) parts.push(`type=${[...f.areaTypes].join('/')}`);
  if (f.activities.size) parts.push(`activity=${[...f.activities].join('/')}`);
  if (f.flMin > FL_FLOOR || f.flMax < FL_CEILING)
    parts.push(`FL ${Math.round(f.flMin / 100)}–${Math.round(f.flMax / 100)}`);
  if (f.timeFrom || f.timeTo) parts.push(`time ${f.timeFrom || '…'}–${f.timeTo || '…'}`);
  return parts.length ? parts.join(', ') : 'none';
}

function csvField(v: string): string {
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function toCsv(rows: string[][]): string {
  return rows.map((r) => r.map(csvField).join(',')).join('\r\n');
}

export function buildTmaCsv(
  columns: TmaColumn[],
  meta: Meta,
  filters: FilterState,
  generatedAtIso: string,
): string {
  const rows: string[][] = [
    ['NOTAM Retrieval System — TMA export'],
    ['Bulletin', String(meta.bulletinNr ?? '')],
    ['Date', meta.bulletinDate ?? ''],
    ['Source', meta.source ?? ''],
    ['Generated', generatedAtIso],
    ['Filters applied', describeFilters(filters)],
    [],
    HEADERS,
  ];
  for (const col of columns) {
    for (const n of col.notams) rows.push(notamRow(col.name, n));
  }
  return toCsv(rows);
}

/** Trigger a browser download of `text` as `filename`. */
export function downloadText(filename: string, text: string, mime = 'text/csv'): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportFilename(meta: Meta): string {
  const parts = [meta.source, meta.bulletinNr, meta.bulletinDate].filter(Boolean).join('_');
  const base = (parts || 'NOTAM').replace(/[^\w.-]+/g, '_');
  return `${base}_TMA-NOTAMs.csv`;
}
