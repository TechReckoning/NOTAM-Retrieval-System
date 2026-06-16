import { bucketByAreas } from '@notam/parser';
import { useMemo } from 'react';
import { applyFilters } from '../lib/filter';
import { TMA_AREAS } from '../lib/tma';
import type { LoadedNotam } from '../lib/types';
import { useStore } from '../state/store';
import { NotamCard } from './NotamCard';

/**
 * List View Mode: per-TMA briefing. The same left-bar filters drive two (or more)
 * lists, one per TMA, each showing the filter-matched NOTAMs that fall within that
 * terminal area. NOTAMs without geometry, and those outside every listed TMA, are
 * surfaced as counts so nothing disappears silently.
 */
export function ListView(): JSX.Element {
  const notams = useStore((s) => s.notams);
  const filters = useStore((s) => s.filters);

  const { columns, noGeometry, outside } = useMemo(() => {
    // List View ignores the map-only spatial controls (TMA preset / drawn area).
    const { visible } = applyFilters(notams, { ...filters, drawnArea: null });
    const areas = TMA_AREAS.map((t) => ({ id: t.id, geometry: t.geometry }));
    const result = bucketByAreas<LoadedNotam>(visible, areas);
    const cols = TMA_AREAS.map((t) => ({ tma: t, items: result.byArea[t.id] ?? [] }));
    return { columns: cols, noGeometry: result.noGeometry, outside: result.outside };
  }, [notams, filters]);

  return (
    <main className="listview">
      <div className="listview-counts">
        <span title="Named zones without coordinates yet (pending the airspace gazetteer)">
          ⚑ {noGeometry.length} not placeable yet
        </span>
        <span title="NOTAMs with geometry that fall outside every listed TMA">
          ◇ Outside listed areas: {outside.length}
        </span>
      </div>
      <div className="listview-cols" style={{ gridTemplateColumns: `repeat(${columns.length}, 1fr)` }}>
        {columns.map(({ tma, items }) => (
          <section key={tma.id} className="tma-col">
            <header className="tma-col-head">
              {tma.name}
              {tma.approximate ? ' ≈' : ''}
              <span className="tma-col-count">{items.length}</span>
            </header>
            <ul className="tma-col-list">
              {items.map((n) => (
                <NotamCard key={n.uid} notam={n} />
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
