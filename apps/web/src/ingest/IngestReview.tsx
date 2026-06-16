import { parseDocx, type Bulletin } from '@notam/parser';
import { useState } from 'react';
import demoBulletin from '../../../../data/samples/bnz327.json';
import { resolveZones } from '../lib/gazetteer';
import { withUids } from '../lib/types';
import { useStore } from '../state/store';

interface Props {
  onClose: () => void;
}

export function IngestReview({ onClose }: Props): JSX.Element {
  const setData = useStore((s) => s.setData);
  const [bulletin, setBulletin] = useState<Bulletin | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [busy, setBusy] = useState(false);

  async function onFile(file: File): Promise<void> {
    setBusy(true);
    setError('');
    try {
      const buf = await file.arrayBuffer();
      const parsed = await parseDocx(buf);
      // Resolve named-zone (LRTRA/LRD/…) geometry from the AIP gazetteer.
      const notams = await resolveZones(parsed.notams);
      setBulletin({ ...parsed, notams });
      setFileName(file.name);
      if (parsed.notams.length === 0) {
        setError(
          'No NOTAMs found. If this is a legacy .doc, re-save it as .docx from Word so the table structure is preserved.',
        );
      }
    } catch (e) {
      setError(`Could not parse file: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  function loadDemo(): void {
    setBulletin(demoBulletin as unknown as Bulletin);
    setFileName('BNZ327.docx (demo)');
    setError('');
  }

  function commit(): void {
    if (!bulletin) return;
    setData(withUids(bulletin.notams), {
      bulletinNr: bulletin.bulletinNr,
      bulletinDate: bulletin.bulletinDate,
      source: bulletin.source,
    });
    onClose();
  }

  const withGeom = bulletin?.notams.filter((n) => n.geometry).length ?? 0;
  const flagged = bulletin?.notams.filter((n) => n.warnings.length > 0).length ?? 0;

  return (
    <div className="ingest-overlay">
      <div className="ingest-modal">
        <header className="ingest-head">
          <h2>Load NOTAM bulletin</h2>
          <button className="btn ghost" onClick={onClose}>
            ✕
          </button>
        </header>

        <div className="ingest-actions">
          <label className="btn primary">
            {busy ? 'Parsing…' : 'Choose .docx…'}
            <input
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              hidden
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            />
          </label>
          <button className="btn" onClick={loadDemo}>
            Load demo bulletin (BNZ 327)
          </button>
        </div>

        {error && <div className="ingest-error">{error}</div>}

        {bulletin && (
          <>
            <div className="ingest-summary">
              <strong>{fileName}</strong> — bulletin {bulletin.bulletinNr ?? '?'} for{' '}
              {bulletin.bulletinDate ?? '?'}. {bulletin.notams.length} NOTAMs · {withGeom} with
              geometry · {flagged} flagged for review.
            </div>
            <div className="ingest-table-wrap">
              <table className="ingest-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Type</th>
                    <th>Activity</th>
                    <th>Lower</th>
                    <th>Upper</th>
                    <th>Schedule</th>
                    <th>Geometry</th>
                    <th>Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {bulletin.notams.map((n, i) => (
                    <tr key={`${n.id}#${i}`} className={n.warnings.length ? 'flagged' : ''}>
                      <td>{n.id}</td>
                      <td>{n.areaTypeRaw || n.areaType}</td>
                      <td>{n.activities.join(', ')}</td>
                      <td>{n.lower.raw}</td>
                      <td>{n.upper.raw}</td>
                      <td>{n.schedules.map((s) => `${s.rawFrom}–${s.rawTo}`).join(', ')}</td>
                      <td>{n.geometrySource}</td>
                      <td title={n.warnings.join('\n')}>
                        {n.warnings.length ? `⚠ ${n.warnings.length}` : '✓'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <footer className="ingest-foot">
              <button className="btn primary" onClick={commit} disabled={bulletin.notams.length === 0}>
                Load {bulletin.notams.length} NOTAMs to map →
              </button>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
