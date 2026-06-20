import booleanIntersects from '@turf/boolean-intersects';
import { feature } from '@turf/helpers';
import { bandsOverlap, bucketByAreas } from '@notam/parser';
import { useMemo, useState } from 'react';
import { isAllocatedTo } from '../lib/allocations';
import { applyFilters } from '../lib/filter';
import { buildOverlaps } from '../lib/overlaps';
import { statusFor } from '../lib/status';
import { TMA_AREAS, type TmaArea } from '../lib/tma';
import type { LoadedNotam } from '../lib/types';
import { useStore } from '../state/store';
import { NotamCard, type Basis } from './NotamCard';

/** Does a NOTAM's vertical band overlap the TMA's floor/ceiling slab? */
function overlapsVertically(n: LoadedNotam, tma: TmaArea): boolean {
  const low = Number.isFinite(n.lower.feet) ? n.lower.feet : 0; // GND if unknown
  const high = Number.isFinite(n.upper.feet) ? n.upper.feet : Number.POSITIVE_INFINITY;
  return bandsOverlap(low, high, tma.floorFt, tma.ceilingFt);
}

/**
 * List View Mode: per-TMA briefing. The same left-bar filters drive two (or more)
 * lists, one per TMA, each showing the filter-matched NOTAMs that fall within that
 * terminal area. NOTAMs without geometry, and those outside every listed TMA, are
 * surfaced as counts so nothing disappears silently.
 */
export function ListView(): JSX.Element {
  const notams = useStore((s) => s.notams);
  const filters = useStore((s) => s.filters);
  const meta = useStore((s) => s.meta);
  const opTime = useStore((s) => s.opTime);
  const activeOnly = useStore((s) => s.activeOnly);

  const { columns, noGeometry, outside, overlapPartners } = useMemo(() => {
    // List View ignores the map-only spatial controls (TMA preset / drawn area).
    const { visible: matched } = applyFilters(notams, { ...filters, drawnArea: null });
    const visible = activeOnly
      ? matched.filter((n) => statusFor(n, opTime) === 'active')
      : matched;
    const overlaps = buildOverlaps(visible, opTime).partners;
    // Lateral test uses the 5 NM buffer (the effective filter area).
    const areas = TMA_AREAS.map((t) => ({ id: t.id, geometry: t.bufferGeometry }));
    const result = bucketByAreas<LoadedNotam>(visible, areas);
    // A NOTAM belongs to a TMA if it overlaps the buffered area (lateral AND
    // vertical) OR is allocated to it. Basis: inside the true boundary => 'in';
    // only within the 5 NM buffer => 'buffer'; otherwise 'allocated'.
    const placed = new Set<string>();
    const cols = TMA_AREAS.map((t) => {
      const inBufferLateral = new Set((result.byArea[t.id] ?? []).map((n) => n.uid));
      const items: { notam: LoadedNotam; basis: Basis }[] = [];
      for (const n of visible) {
        const inBuffer = inBufferLateral.has(n.uid) && overlapsVertically(n, t);
        const allocated = isAllocatedTo(n, t.id);
        if (!inBuffer && !allocated) continue;
        let basis: Basis = 'allocated';
        if (inBuffer) {
          const inTrue = !!n.geometry && booleanIntersects(feature(t.geometry), feature(n.geometry));
          basis = inTrue ? 'in' : 'buffer';
        }
        items.push({ notam: n, basis });
        placed.add(n.uid);
      }
      return { tma: t, items };
    });
    // Outside = geometry present but in no TMA (lateral/vertical miss and not allocated).
    const outsideAll = visible.filter((n) => n.geometry && !placed.has(n.uid));
    // Not placeable = no geometry and not allocated to any TMA.
    const noGeom = visible.filter((n) => !n.geometry && !placed.has(n.uid));
    return { columns: cols, noGeometry: noGeom, outside: outsideAll, overlapPartners: overlaps };
  }, [notams, filters, activeOnly, opTime]);

  const totalShown = columns.reduce((sum, c) => sum + c.items.length, 0);
  const [exporting, setExporting] = useState(false);

  async function exportPdf(): Promise<void> {
    setExporting(true);
    try {
      const { exportTmaPdf } = await import('../lib/pdf');
      const cols = columns.map((c) => ({
        name: c.tma.name,
        band: `${c.tma.floorLabel} – ${c.tma.ceilingLabel}`,
        notams: c.items.map((it) => it.notam),
      }));
      await exportTmaPdf(cols, meta ?? { bulletinNr: null, bulletinDate: null, source: null }, filters);
    } finally {
      setExporting(false);
    }
  }

  return (
    <main className="listview">
      <div className="listview-counts">
        <span title="Named zones without coordinates yet (pending the airspace gazetteer)">
          ⚑ {noGeometry.length} not placeable yet
        </span>
        <span title="NOTAMs with geometry that fall outside every listed TMA">
          ◇ Outside listed areas: {outside.length}
        </span>
        <button
          className="btn export-btn"
          onClick={exportPdf}
          disabled={totalShown === 0 || exporting}
          title="Export the TMA NAPOC + TMA BUCUREȘTI lists (current filters) as a PDF briefing"
        >
          {exporting ? 'Preparing…' : '⭳ Export PDF'}
        </button>
      </div>
      <div className="listview-cols" style={{ gridTemplateColumns: `repeat(${columns.length}, 1fr)` }}>
        {columns.map(({ tma, items }) => (
          <section key={tma.id} className="tma-col">
            <header className="tma-col-head">
              {tma.name}
              {tma.approximate ? ' ≈' : ''}
              <span className="tma-col-band">
                {tma.floorLabel} – {tma.ceilingLabel}
              </span>
              <span className="tma-col-count">{items.length}</span>
            </header>
            <ul className="tma-col-list">
              {items.map(({ notam, basis }) => (
                <NotamCard
                  key={notam.uid}
                  notam={notam}
                  basis={basis}
                  status={statusFor(notam, opTime)}
                  overlapCount={overlapPartners.get(notam.uid)?.length ?? 0}
                />
              ))}
              {items.length === 0 && (
                <li className="empty">No NOTAMs in this area match the filters.</li>
              )}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
