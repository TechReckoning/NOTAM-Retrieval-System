import { AREA_TYPE_LABELS } from '@notam/parser';
import { useMemo, useState } from 'react';
import { areaColor } from '../lib/colors';
import { buildQualityReport, CATEGORY_LABEL, type QualityCategory } from '../lib/quality';
import { useStore } from '../state/store';

interface Props {
  onClose: () => void;
}

/**
 * Data-quality / trust panel — every NOTAM the parser flagged as uncertain,
 * grouped by category, with drill-down. Covers the whole loaded bulletin
 * (independent of the operational filters).
 */
export function QualityPanel({ onClose }: Props): JSX.Element {
  const notams = useStore((s) => s.notams);
  const select = useStore((s) => s.select);
  const report = useMemo(() => buildQualityReport(notams), [notams]);
  const [filter, setFilter] = useState<QualityCategory | 'all'>('all');

  const items = report.items.filter((it) => filter === 'all' || it.categories.includes(filter));

  function jumpTo(uid: string): void {
    select(uid);
    onClose();
  }

  return (
    <div className="ingest-overlay">
      <div className="ingest-modal quality-modal">
        <header className="ingest-head">
          <h2>Data quality</h2>
          <button className="btn ghost" onClick={onClose}>
            ✕
          </button>
        </header>

        <div className="ingest-summary">
          {report.total} NOTAMs · {report.withGeometry} with geometry ·{' '}
          <strong>{report.flaggedCount} flagged for review</strong>
          {report.notPlaceable > 0 && ` · ${report.notPlaceable} not placeable`}
        </div>

        {report.flaggedCount === 0 ? (
          <div className="quality-clear">✓ No data-quality issues flagged in this bulletin.</div>
        ) : (
          <>
            <div className="chips quality-cats">
              <button
                className={`chip${filter === 'all' ? ' on' : ''}`}
                onClick={() => setFilter('all')}
              >
                All ({report.flaggedCount})
              </button>
              {report.byCategory.map((c) => (
                <button
                  key={c.key}
                  className={`chip${filter === c.key ? ' on' : ''}`}
                  onClick={() => setFilter(c.key)}
                >
                  {c.label} ({c.count})
                </button>
              ))}
            </div>

            <div className="ingest-table-wrap">
              <table className="ingest-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Type</th>
                    <th>Issue(s)</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr
                      key={it.notam.uid}
                      className="quality-row"
                      onClick={() => jumpTo(it.notam.uid)}
                      title="Select this NOTAM"
                    >
                      <td>
                        <span className="row-id" style={{ background: areaColor(it.notam.areaType) }}>
                          {it.notam.id}
                        </span>
                      </td>
                      <td>{AREA_TYPE_LABELS[it.notam.areaType] ?? it.notam.areaType}</td>
                      <td>
                        {it.categories.map((c) => (
                          <span key={c} className="quality-cat-tag">
                            {CATEGORY_LABEL[c]}
                          </span>
                        ))}
                        <div className="quality-msgs">{it.messages.join(' · ')}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <footer className="ingest-foot quality-foot">
          Decision-support only — verify every flagged item against the authoritative AIP/NOTAM
          service before operational use.
        </footer>
      </div>
    </div>
  );
}
