import { describe, expect, it } from 'vitest';
import { consolidateBulletins } from '../src/consolidate.js';
import { extractEntryMarkers } from '../src/bundle.js';
import type { Bulletin, BulletinKind, Notam } from '../src/types.js';

function notam(id: string, descr = '', series = id[0]): Notam {
  return {
    id,
    series,
    bulletinNr: null,
    bulletinDate: null,
    areaType: 'WARNING',
    areaTypeRaw: '',
    zoneRefs: [],
    title: descr,
    description: descr,
    activities: [],
    activityRaw: '',
    lower: { kind: 'GND', raw: 'GND', feet: 0 },
    upper: { kind: 'FL', raw: 'FL 100', feet: 10000 },
    schedules: [],
    coordUnits: [],
    geometry: null,
    geometrySource: 'none',
    warnings: [],
    markers: extractEntryMarkers(descr),
  };
}

function bulletin(
  kind: BulletinKind,
  sequence: number | null,
  bulletinDate: string | null,
  bulletinNr: number | null,
  notams: Notam[],
  issuedDate = '2026-06-21',
): Bulletin {
  return { bulletinNr, bulletinDate, issuedDate, source: 'BNLR', kind, sequence, notams };
}

const find = (b: { entries: { notam: Notam }[] }, id: string) =>
  b.entries.find((e) => e.notam.id === id)!;

describe('consolidateBulletins', () => {
  it('22.06-like: base modification resolves to its replacement; supplement adds', () => {
    const base = bulletin('BASE', null, '2026-06-22', 338, [
      notam('P0029', 'LRTRA 40  (MODIFICAT P0061)'),
      notam('P0030', 'LRTRA 42 G'),
    ]);
    const modif = bulletin('MODIFICARE', 1, '2026-06-22', 338, [notam('P0061', 'LRTRA 40')]);
    const compl = bulletin('COMPLETARE', 1, '2026-06-22', 338, [notam('B7683', 'LRTSA 59 BUZAU')]);

    const { bundles, warnings } = consolidateBulletins([base, modif, compl]);
    expect(bundles).toHaveLength(1);
    expect(warnings).toEqual([]);
    const b = bundles[0];

    expect(find(b, 'P0029').state).toBe('superseded');
    expect(find(b, 'P0029').relatedRef).toBe('P0061');
    expect(find(b, 'P0061').state).toBe('replaces');
    expect(find(b, 'P0061').relatedRef).toBe('P0029');
    expect(find(b, 'P0030').state).toBe('current');
    expect(find(b, 'B7683').state).toBe('added');
    expect(b.documents).toHaveLength(3);
  });

  it('18.06-like: an unreferenced modification is flagged as an orphan, with warnings', () => {
    const base = bulletin('BASE', null, '2026-06-18', 317, [notam('B7004', 'LRD 03 A')]);
    // Header said "NR. 313" (the real-world typo); base 313 is not loaded.
    const modif = bulletin('MODIFICARE', 1, '2026-06-18', 313, [
      notam('B7189', 'Poligon NORD PADURE'),
    ]);

    const { bundles } = consolidateBulletins([base, modif]);
    expect(bundles).toHaveLength(1);
    const b = bundles[0];
    expect(find(b, 'B7189').state).toBe('orphan-modification');
    expect(b.warnings.some((w) => /B7189/.test(w))).toBe(true);
    expect(b.warnings.some((w) => /base NR\. 313/.test(w))).toBe(true);
  });

  it('21.06-like: documents for different operational dates split into separate bundles', () => {
    const a = bulletin('BASE', null, '2026-06-21', 336, [notam('C9001')]);
    const c = bulletin('BASE', null, '2026-06-27', 337, []);

    const { bundles, warnings } = consolidateBulletins([a, c]);
    expect(bundles).toHaveLength(2);
    expect(bundles.map((x) => x.operationalDate)).toEqual(['2026-06-27', '2026-06-21']);
    expect(warnings.some((w) => /multiple operational dates/.test(w))).toBe(true);
  });

  it('does NOT flag zone-labelled entries (no NOTAM number) as duplicates', () => {
    // A bulletin with no number column: ids fall back to the zone designator and
    // repeat — that is normal, not a currency conflict.
    const z1 = notam('LRTRA 71 G', 'LRTRA 71 G', '');
    const z2 = notam('LRTRA 71 G', 'LRTRA 71 G', '');
    const base = bulletin('BASE', null, '2026-06-21', 336, [z1, z2]);
    const b = consolidateBulletins([base]).bundles[0];
    expect(b.entries.every((e) => e.state === 'current')).toBe(true);
    expect(b.warnings).toEqual([]);
  });

  it('cancellation marker is surfaced, not dropped', () => {
    const base = bulletin('BASE', null, '2026-06-22', 338, [notam('D1000', 'Zona X (ANULAT)')]);
    const b = consolidateBulletins([base]).bundles[0];
    expect(find(b, 'D1000').state).toBe('cancelled');
    expect(b.entries).toHaveLength(1); // nothing dropped
  });
});
