import { useStore } from '../state/store';

interface Props {
  onClose: () => void;
}

const KIND_LABEL: Record<string, string> = {
  BASE: 'Base',
  COMPLETARE: 'Supplement',
  MODIFICARE: 'Modification',
};

/**
 * Bundle currency panel — what was consolidated for the operational date: the
 * source documents, integrity warnings, and the entries set aside (superseded /
 * cancelled) so nothing is hidden. Read-only; the engine never auto-resolves.
 */
export function CurrencyPanel({ onClose }: Props): JSX.Element {
  const bundle = useStore((s) => s.bundle);

  return (
    <div className="ingest-overlay">
      <div className="ingest-modal quality-modal">
        <header className="ingest-head">
          <h2>Bundle currency</h2>
          <button className="btn ghost" onClick={onClose}>
            ✕
          </button>
        </header>

        {!bundle ? (
          <div className="quality-clear">No bundle loaded.</div>
        ) : (
          <>
            <div className="ingest-summary">
              Operational date <strong>{bundle.operationalDate ?? 'undated'}</strong> ·{' '}
              {bundle.documents.length} document(s) ·{' '}
              {Object.entries(bundle.counts)
                .map(([s, n]) => `${n} ${s}`)
                .join(' · ')}
              {bundle.otherDates.length > 0 && (
                <span className="freshness-warn">
                  {' '}
                  · other dates uploaded but not shown: {bundle.otherDates.join(', ')}
                </span>
              )}
            </div>

            <h3 className="panel-subhead">Documents</h3>
            <div className="bundle-docs">
              {bundle.documents.map((d, i) => (
                <span key={i} className="bundle-doc">
                  {KIND_LABEL[d.kind] ?? d.kind}
                  {d.sequence != null ? ` ${d.sequence}` : ''} · NR. {d.bulletinNr ?? '?'} · issued{' '}
                  {d.issuedDate ?? '?'} · {d.entryCount} entries
                </span>
              ))}
            </div>

            <h3 className="panel-subhead">
              Integrity {bundle.warnings.length === 0 ? '✓' : `⚠ ${bundle.warnings.length}`}
            </h3>
            {bundle.warnings.length === 0 ? (
              <div className="quality-clear">No integrity issues detected in this bundle.</div>
            ) : (
              <ul className="bundle-warnings">
                {bundle.warnings.map((w, i) => (
                  <li key={i}>⚠ {w}</li>
                ))}
              </ul>
            )}

            <h3 className="panel-subhead">Set aside ({bundle.setAside.length})</h3>
            {bundle.setAside.length === 0 ? (
              <div className="quality-clear">Nothing superseded or cancelled.</div>
            ) : (
              <>
                <div className="panel-note">
                  Kept out of the active map/list (so the picture isn&apos;t double-counted), shown
                  here for the record — verify before acting.
                </div>
                <div className="ingest-table-wrap">
                  <table className="ingest-table">
                    <thead>
                      <tr>
                        <th>NOTAM</th>
                        <th>State</th>
                        <th>Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bundle.setAside.map((e, i) => (
                        <tr key={i} className={`state-${e.state}`}>
                          <td>{e.id}</td>
                          <td>
                            {e.state}
                            {e.relatedRef ? ` → ${e.relatedRef}` : ''}
                          </td>
                          <td>{e.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}

        <footer className="ingest-foot quality-foot">
          Decision-support only — this consolidation surfaces relationships for review and never
          auto-resolves them. Always verify currency against the authoritative AIP/NOTAM service.
        </footer>
      </div>
    </div>
  );
}
