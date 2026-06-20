import { ACTIVITY_LABELS, AREA_TYPE_LABELS } from '@notam/parser';
import { useMemo } from 'react';
import { areaColor } from '../lib/colors';
import { buildOverlaps, overlapScopeSet } from '../lib/overlaps';
import type { LoadedNotam } from '../lib/types';
import { useStore } from '../state/store';

interface Props {
  onClose: () => void;
}

function acts(n: LoadedNotam): string {
  return n.activities.map((a) => ACTIVITY_LABELS[a] ?? a).join(', ');
}

/**
 * Overlaps panel — pairs of co-active NOTAMs whose airspaces overlap within the
 * current filter scope, excluding military-only overlaps.
 */
export function OverlapsPanel({ onClose }: Props): JSX.Element {
  const notams = useStore((s) => s.notams);
  const filters = useStore((s) => s.filters);
  const viewMode = useStore((s) => s.viewMode);
  const opTime = useStore((s) => s.opTime);
  const select = useStore((s) => s.select);

  const { pairs } = useMemo(
    () => buildOverlaps(overlapScopeSet(notams, filters, viewMode), opTime),
    [notams, filters, viewMode, opTime],
  );

  const tag = (n: LoadedNotam) => (
    <button className="overlap-id" style={{ background: areaColor(n.areaType) }} onClick={() => { select(n.uid); onClose(); }}>
      {n.id}
    </button>
  );

  return (
    <div className="ingest-overlay">
      <div className="ingest-modal quality-modal">
        <header className="ingest-head">
          <h2>Overlaps</h2>
          <button className="btn ghost" onClick={onClose}>
            ✕
          </button>
        </header>

        <div className="ingest-summary">
          <strong>{pairs.length}</strong> co-active overlap{pairs.length === 1 ? '' : 's'} at the
          operational time {opTime.slice(11, 16)}Z · military-only overlaps excluded
        </div>

        {pairs.length === 0 ? (
          <div className="quality-clear">✓ No relevant overlaps at this time.</div>
        ) : (
          <div className="ingest-table-wrap">
            <table className="ingest-table">
              <thead>
                <tr>
                  <th>Overlapping NOTAMs</th>
                  <th>Types / activities</th>
                </tr>
              </thead>
              <tbody>
                {pairs.map(({ a, b }, i) => (
                  <tr key={i} className="overlap-row">
                    <td className="overlap-pair">
                      {tag(a)} <span className="overlap-x">↔</span> {tag(b)}
                    </td>
                    <td>
                      <div>
                        {AREA_TYPE_LABELS[a.areaType] ?? a.areaType} — {acts(a)}
                      </div>
                      <div>
                        {AREA_TYPE_LABELS[b.areaType] ?? b.areaType} — {acts(b)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <footer className="ingest-foot quality-foot">
          Decision-support only — verify overlapping activations against the authoritative
          AIP/NOTAM service and ATC coordination before operational use.
        </footer>
      </div>
    </div>
  );
}
