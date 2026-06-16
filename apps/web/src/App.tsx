import { lazy, Suspense, useMemo, useState } from 'react';
import { Filters } from './filters/Filters';
import { AREA_COLORS } from './lib/colors';
import { applyFilters } from './lib/filter';
import { ListView } from './list/ListView';
import { NotamList } from './list/NotamList';
import { MapView } from './map/MapView';
import { useStore } from './state/store';
import { AREA_TYPE_LABELS } from '@notam/parser';

// Lazy so the bulletin parser (mammoth) only loads when the user opens ingest.
const IngestReview = lazy(() =>
  import('./ingest/IngestReview').then((m) => ({ default: m.IngestReview })),
);

export function App(): JSX.Element {
  const meta = useStore((s) => s.meta);
  const viewMode = useStore((s) => s.viewMode);
  const setViewMode = useStore((s) => s.setViewMode);
  const [showIngest, setShowIngest] = useState(true);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">▲</span> NOTAM Retrieval System
        </div>
        <div className="mode-toggle" role="tablist" aria-label="View mode">
          <button
            className={`mode-tab${viewMode === 'map' ? ' on' : ''}`}
            onClick={() => setViewMode('map')}
          >
            Map View
          </button>
          <button
            className={`mode-tab${viewMode === 'list' ? ' on' : ''}`}
            onClick={() => setViewMode('list')}
          >
            List View
          </button>
        </div>
        <div className="bulletin-meta">
          {meta
            ? `Bulletin ${meta.bulletinNr ?? '?'} · ${meta.bulletinDate ?? '?'} · ${meta.source ?? ''}`
            : 'No bulletin loaded'}
        </div>
        {viewMode === 'map' && (
          <div className="legend">
            {Object.entries(AREA_COLORS)
              .filter(([k]) => k !== 'UNKNOWN')
              .map(([k, c]) => (
                <span key={k} className="legend-item">
                  <i style={{ background: c }} /> {AREA_TYPE_LABELS[k] ?? k}
                </span>
              ))}
          </div>
        )}
        <button className="btn" onClick={() => setShowIngest(true)}>
          Load bulletin
        </button>
      </header>

      <div className={`body ${viewMode}`}>
        <aside className="sidebar">
          <Filters />
        </aside>
        {viewMode === 'map' ? <MapBody /> : <ListView />}
      </div>

      {showIngest && (
        <Suspense fallback={null}>
          <IngestReview onClose={() => setShowIngest(false)} />
        </Suspense>
      )}
    </div>
  );
}

/** Map View Mode body: the map plus the synchronized scrollable list. */
function MapBody(): JSX.Element {
  const notams = useStore((s) => s.notams);
  const filters = useStore((s) => s.filters);
  const { visible, hiddenNoGeometry } = useMemo(
    () => applyFilters(notams, filters),
    [notams, filters],
  );
  return (
    <>
      <main className="map-area">
        <MapView visible={visible} />
      </main>
      <aside className="list-area">
        <NotamList visible={visible} hiddenNoGeometry={hiddenNoGeometry} />
      </aside>
    </>
  );
}
