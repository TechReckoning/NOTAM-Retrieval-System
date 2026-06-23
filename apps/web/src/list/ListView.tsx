import booleanIntersects from '@turf/boolean-intersects';
import { feature } from '@turf/helpers';
import { bandsOverlap, bucketByAreas, classifyTmaMembership, isLrManagedZone } from '@notam/parser';
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
    // Membership rule (single source of truth in @notam/parser):
    //  - LRTRA/LRTSA/LRD zones: relevant only if allocated; if present-but-
    //    unallocated they go to a separate awareness list (lrItems).
    //  - everything else: relevant if geometric (3-D) OR allocated.
    // Basis reflects physical position: inside true boundary 'in', else buffer
    // 'buffer', else 'allocated'.
    const placed = new Set<string>();
    const cols = TMA_AREAS.map((t) => {
      const inBufferLateral = new Set((result.byArea[t.id] ?? []).map((n) => n.uid));
      const items: { notam: LoadedNotam; basis: Basis }[] = [];
      const lrItems: { notam: LoadedNotam; where: 'in' | 'buffer' }[] = [];
      for (const n of visible) {
        const inBuffer = inBufferLateral.has(n.uid) && overlapsVertically(n, t);
        const inTrue =
          inBuffer && !!n.geometry && booleanIntersects(feature(t.geometry), feature(n.geometry));
        const rel = classifyTmaMembership({
          isLr: isLrManagedZone(n),
          allocated: isAllocatedTo(n, t.id),
          inBuffer,
          inTrue,
        });
        if (rel.kind === 'relevant') {
          items.push({ notam: n, basis: rel.basis });
          placed.add(n.uid);
        } else if (rel.kind === 'lr-present') {
          lrItems.push({ notam: n, where: rel.where });
          placed.add(n.uid);
        }
      }
      return { tma: t, items, lrItems };
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
        lrUnallocated: c.lrItems,
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
        {columns.map(({ tma, items, lrItems }) => (
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
              {lrItems.length > 0 && (
                <li className="lr-section">
                  <div className="lr-section-head">
                    Not-allocated LR present <span className="lr-section-count">{lrItems.length}</span>
                    <span className="lr-section-hint">
                      LRTRA/LRTSA/LRD physically in/near this TMA but not allocated to it — awareness
                      only
                    </span>
                  </div>
                  <ul className="lr-section-list">
                    {lrItems.map(({ notam, where }) => (
                      <NotamCard
                        key={notam.uid}
                        notam={notam}
                        lrPresent={where}
                        status={statusFor(notam, opTime)}
                        overlapCount={overlapPartners.get(notam.uid)?.length ?? 0}
                      />
                    ))}
                  </ul>
                </li>
              )}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
