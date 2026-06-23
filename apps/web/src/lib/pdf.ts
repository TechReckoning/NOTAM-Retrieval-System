/**
 * PDF export for List View Mode — a printable briefing of the TMA NAPOC + TMA
 * BUCUREȘTI lists, reflecting the currently applied filters. One table per TMA,
 * with a header (bulletin, filters, generated-at) and a disclaimer.
 *
 * Generated client-side (jsPDF + autotable), works offline. Romanian diacritics
 * are transliterated to ASCII — consistent with the ICAO convention that NOTAMs
 * are transmitted in ASCII — so the standard PDF fonts render everything cleanly.
 */

import { ACTIVITY_LABELS, AREA_TYPE_LABELS } from '@notam/parser';
import { describeFilters, type TmaColumn } from './export';
import type { FilterState } from './filter';
import type { LoadedNotam } from './types';

interface Meta {
  bulletinNr: number | null;
  bulletinDate: string | null;
  source: string | null;
}

/** Transliterate to ASCII (strip diacritics, normalize dashes/quotes). */
function ascii(s: string): string {
  return (s ?? '')
    .replace(/[–—]/g, '-')
    .replace(/[’]/g, "'")
    .replace(/[„”]/g, '"')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function fmtWindow(s: LoadedNotam['schedules'][number]): string {
  if (!s.fromUTC || !s.toUTC) return `${s.rawFrom}-${s.rawTo}`;
  const t = (iso: string) => iso.slice(0, 16).replace('T', ' ');
  return `${t(s.fromUTC)} - ${t(s.toUTC)}Z`;
}

const COLUMNS = [
  'NOTAM',
  'Type',
  'Activity',
  'Lower',
  'Upper',
  'Active (UTC)',
  'Coordination',
  'Contact',
];

function rowFor(n: LoadedNotam): string[] {
  return [
    n.id,
    AREA_TYPE_LABELS[n.areaType] ?? n.areaType,
    n.activities.map((a) => ACTIVITY_LABELS[a] ?? a).join(', '),
    n.lower.raw,
    n.upper.raw,
    n.schedules.map(fmtWindow).join('  '),
    n.coordUnits.join(' '),
    n.contact ?? '',
  ].map(ascii);
}

const DISCLAIMER =
  'Decision-support aid only — NOT an official source of aeronautical information. ' +
  'Always cross-check against the authoritative AIP/NOTAM service before operational use.';

/** Build the briefing PDF document (no download) — reusable/verifiable. */
export async function buildTmaPdfDoc(columns: TmaColumn[], meta: Meta, filters: FilterState) {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 12;

  // ---- header ----
  doc.setFont('helvetica', 'bold').setFontSize(14);
  doc.text('NOTAM Briefing — Terminal Control Areas', margin, 16);
  doc.setFont('helvetica', 'normal').setFontSize(9);
  const sub = `Bulletin ${meta.bulletinNr ?? '?'}  ·  ${meta.bulletinDate ?? '?'}  ·  ${ascii(
    meta.source ?? '',
  )}`;
  doc.text(sub, margin, 22);
  doc.text(
    `Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')}Z   |   Filters: ${ascii(
      describeFilters(filters),
    )}`,
    margin,
    27,
  );

  const finalY = () => (doc as any).lastAutoTable.finalY as number;
  const emptyRow = ['', '—', '', '', '', '', '', '', ''];

  /** A numbered NOTAM table under a sub-heading. */
  const subTable = (title: string, list: LoadedNotam[], startY: number): number => {
    autoTable(doc, {
      startY,
      head: [[`${title}  —  ${list.length}`]],
      body: [],
      theme: 'plain',
      headStyles: { fontStyle: 'bold', fontSize: 9, textColor: [60, 70, 90] },
      margin: { left: margin, right: margin },
    });
    autoTable(doc, {
      startY: finalY() + 0.5,
      head: [['No', ...COLUMNS]],
      body: list.length ? list.map((n, i) => [String(i + 1), ...rowFor(n)]) : [emptyRow],
      styles: { fontSize: 7.5, cellPadding: 1.4, overflow: 'linebreak', valign: 'top' },
      headStyles: { fillColor: [27, 37, 64], textColor: 255, fontSize: 8 },
      alternateRowStyles: { fillColor: [244, 246, 250] },
      columnStyles: {
        0: { cellWidth: 9, halign: 'right' },
        1: { cellWidth: 18, fontStyle: 'bold' },
        4: { cellWidth: 20 },
        5: { cellWidth: 20 },
        6: { cellWidth: 52 },
      },
      margin: { left: margin, right: margin },
    });
    return finalY();
  };

  let startY = 33;
  for (const col of columns) {
    const bandText = col.band ? `  (${ascii(col.band)})` : '';
    // Split: military corridors (M-series) vs the rest.
    const corridors = col.notams.filter((n) => n.series === 'M');
    const rest = col.notams.filter((n) => n.series !== 'M');

    autoTable(doc, {
      startY,
      head: [[`${ascii(col.name)}${bandText}  —  ${col.notams.length} NOTAM(s)`]],
      body: [],
      theme: 'plain',
      headStyles: { fontStyle: 'bold', fontSize: 11, textColor: [11, 16, 32] },
      margin: { left: margin, right: margin },
    });
    startY = finalY() + 1.5;
    startY = subTable('Areas & zones', rest, startY) + 4;
    startY = subTable('Military corridors (M-series)', corridors, startY) + 8;
  }

  // ---- footer on every page: disclaimer + page numbers ----
  const pages = doc.getNumberOfPages();
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFontSize(7).setTextColor(120);
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.text(DISCLAIMER, margin, pageH - 6, { maxWidth: pageW - 2 * margin - 20 });
    doc.text(`Page ${i}/${pages}`, pageW - margin, pageH - 6, { align: 'right' });
  }

  return doc;
}

export async function exportTmaPdf(
  columns: TmaColumn[],
  meta: Meta,
  filters: FilterState,
): Promise<void> {
  const doc = await buildTmaPdfDoc(columns, meta, filters);
  const name = [meta.source, meta.bulletinNr, meta.bulletinDate]
    .filter(Boolean)
    .join('_')
    .replace(/[^\w.-]+/g, '_');
  doc.save(`${name || 'NOTAM'}_TMA-briefing.pdf`);
}
