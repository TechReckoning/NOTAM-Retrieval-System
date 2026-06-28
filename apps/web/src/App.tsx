import { lazy, Suspense, useMemo, useState } from 'react';
import { Filters } from './filters/Filters';
import { AREA_COLORS } from './lib/colors';
import { applyFilters } from './lib/filter';
import { CurrencyPanel } from './currency/CurrencyPanel';
import { buildOverlaps, overlapScopeSet } from './lib/overlaps';
import { buildQualityReport } from './lib/quality';
import { STATUS_COLOR, STATUS_LABEL, statusFor } from './lib/status';
import { ListView } from './list/ListView';
import { NotamList } from './list/NotamList';
import { MapView } from './map/MapView';
import { OverlapsPanel } from './overlaps/OverlapsPanel';
import { QualityPanel } from './quality/QualityPanel';
import { useStore } from './state/store';
import { AREA_TYPE_LABELS, type ActivationStatus } from '@notam/parser';

// Lazy so the bulletin parser (mammoth) only loads when the user opens ingest.
const IngestReview = lazy(() =>
  import('./ingest/IngestReview').then((m) => ({ default: m.IngestReview })),
);

export function App(): JSX.Element {
  const notams = useStore((s) => s.notams);
  const meta = useStore((s) => s.meta);
  const viewMode = useStore((s) => s.viewMode);
  const setViewMode = useStore((s) => s.setViewMode);
  const filters = useStore((s) => s.filters);
  const opTime = useStore((s) => s.opTime);
  const bundle = useStore((s) => s.bundle);
  const [showIngest, setShowIngest] = useState(true);
  const [showQuality, setShowQuality] = useState(false);
  const [showOverlaps, setShowOverlaps] = useState(false);
  const [showCurrency, setShowCurrency] = useState(false);

  const currencyFlags = bundle ? bundle.warnings.length + bundle.setAside.length : 0;

  const flaggedCount = useMemo(() => buildQualityReport(notams).flaggedCount, [notams]);
  const overlapCount = useMemo(
    () => buildOverlaps(overlapScopeSet(notams, filters, viewMode), opTime).pairs.length,
    [notams, filters, viewMode, opTime],
  );

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
        {meta && (
          <button
            className={`btn overlaps-btn${overlapCount > 0 ? ' has-overlaps' : ''}`}
            onClick={() => setShowOverlaps(true)}
            title="Co-active NOTAM overlaps (military-only excluded)"
          >
            ⧉ {overlapCount} overlap{overlapCount === 1 ? '' : 's'}
          </button>
        )}
        {bundle && (
          <button
            className={`btn currency-btn${currencyFlags > 0 ? ' flagged' : ''}`}
            onClick={() => setShowCurrency(true)}
            title="Bundle currency — source documents, integrity, and set-aside (superseded/cancelled) entries"
          >
            {currencyFlags > 0 ? `⚑ ${currencyFlags} currency` : '✓ Currency'}
          </button>
        )}
        {meta && (
          <button
            className={`btn quality-btn${flaggedCount > 0 ? ' flagged' : ''}`}
            onClick={() => setShowQuality(true)}
            title="Data quality — items the parser flagged for review"
          >
            {flaggedCount > 0 ? `⚠ ${flaggedCount} flagged` : '✓ Data quality'}
          </button>
        )}
        <button className="btn" onClick={() => setShowIngest(true)}>
          Load bulletin
        </button>
      </header>

      {meta && <StatusBar />}

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
      {showQuality && <QualityPanel onClose={() => setShowQuality(false)} />}
      {showOverlaps && <OverlapsPanel onClose={() => setShowOverlaps(false)} />}
      {showCurrency && <CurrencyPanel onClose={() => setShowCurrency(false)} />}
    </div>
  );
}

/** Map View Mode body: the map plus the synchronized scrollable list. */
function MapBody(): JSX.Element {
  const notams = useStore((s) => s.notams);
  const filters = useStore((s) => s.filters);
  const opTime = useStore((s) => s.opTime);
  const activeOnly = useStore((s) => s.activeOnly);
  const { visible, hiddenNoGeometry, lrUnallocated } = useMemo(() => {
    const r = applyFilters(notams, filters);
    if (!activeOnly) return r;
    const isActive = (n: typeof notams[number]) => statusFor(n, opTime) === 'active';
    return {
      ...r,
      visible: r.visible.filter(isActive),
      lrUnallocated: r.lrUnallocated.filter((x) => isActive(x.notam)),
    };
  }, [notams, filters, activeOnly, opTime]);
  return (
    <>
      <main className="map-area">
        <MapView visible={visible} lrUnallocated={lrUnallocated} opTime={opTime} />
      </main>
      <aside className="list-area">
        <NotamList
          visible={visible}
          lrUnallocated={lrUnallocated}
          hiddenNoGeometry={hiddenNoGeometry}
          opTime={opTime}
        />
      </aside>
    </>
  );
}

/** Operational-time control: time cursor + Now + Active-only + status legend + freshness. */
function StatusBar(): JSX.Element {
  const meta = useStore((s) => s.meta);
  const bundle = useStore((s) => s.bundle);
  const opTime = useStore((s) => s.opTime);
  const setOpTime = useStore((s) => s.setOpTime);
  const activeOnly = useStore((s) => s.activeOnly);
  const setActiveOnly = useStore((s) => s.setActiveOnly);

  const date = meta?.bulletinDate ?? opTime.slice(0, 10);
  const timeOfDay = opTime.slice(11, 16); // "HH:MM"
  const today = new Date().toISOString().slice(0, 10);
  const stale = !!meta?.bulletinDate && meta.bulletinDate !== today;

  const setTimeOfDay = (hhmm: string) => hhmm && setOpTime(`${date}T${hhmm}:00Z`);
  const now = () => {
    const d = new Date();
    const hhmm = d.toISOString().slice(11, 16);
    setOpTime(`${date}T${hhmm}:00Z`);
  };

  return (
    <div className="statusbar">
      <span className="statusbar-label">Operational time</span>
      <input
        type="time"
        value={timeOfDay}
        onChange={(e) => setTimeOfDay(e.target.value)}
        aria-label="Operational time of day (UTC)"
      />
      <span className="statusbar-date">{date} UTC</span>
      <button className="btn" onClick={now}>
        Now
      </button>
      <label className="active-only">
        <input
          type="checkbox"
          checked={activeOnly}
          onChange={(e) => setActiveOnly(e.target.checked)}
        />
        Active only
      </label>
      <span className="status-legend">
        {(['active', 'upcoming', 'expired'] as ActivationStatus[]).map((s) => (
          <span key={s} className="legend-item">
            <i style={{ background: STATUS_COLOR[s] }} /> {STATUS_LABEL[s]}
          </span>
        ))}
      </span>
      {stale && (
        <span className="freshness-warn" title="The loaded bulletin is not for today's date">
          ⚠ Bulletin is for {meta!.bulletinDate}, not today ({today}) — verify currency
        </span>
      )}
      {bundle && bundle.documents.length > 1 && (
        <span className="bundle-chip" title="Consolidated from multiple documents — see Currency">
          ⚑ bundle of {bundle.documents.length}
          {bundle.warnings.length > 0 ? ` · ${bundle.warnings.length} issue(s)` : ''}
        </span>
      )}
    </div>
  );
}
