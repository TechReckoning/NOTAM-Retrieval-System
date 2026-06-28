import {
  consolidateBulletins,
  type Bulletin,
  type ConsolidatedBundle,
  type ConsolidationResult,
} from '@notam/parser';
import { useMemo, useState } from 'react';
import demoBulletin from '../../../../data/samples/bnz327.json';
import { buildLoadedBundle } from '../lib/bundle';
import { resolveZones } from '../lib/gazetteer';
import { useStore } from '../state/store';

interface Props {
  onClose: () => void;
}

interface Loaded {
  fileName: string;
  bulletin: Bulletin;
}

const KIND_LABEL: Record<string, string> = {
  BASE: 'Base',
  COMPLETARE: 'Supplement',
  MODIFICARE: 'Modification',
};

const STATE_LABEL: Record<string, string> = {
  current: 'current',
  added: 'added',
  replaces: 'replaces',
  superseded: 'superseded',
  cancelled: 'cancelled',
  'orphan-modification': 'needs review',
  duplicate: 'duplicate',
};

/** Load one or more bulletin documents as a consolidated bundle (currency-aware). */
export function IngestReview({ onClose }: Props): JSX.Element {
  const setData = useStore((s) => s.setData);
  const [loaded, setLoaded] = useState<Loaded[]>([]);
  const [result, setResult] = useState<ConsolidationResult | null>(null);
  const [chosenDate, setChosenDate] = useState<string | null>(null);
  const [error, setError] = useState<string>('');
  const [busy, setBusy] = useState(false);

  function recompute(next: Loaded[]): void {
    setLoaded(next);
    if (next.length === 0) {
      setResult(null);
      return;
    }
    const res = consolidateBulletins(next.map((l) => l.bulletin));
    setResult(res);
    // Default to the operational date with the most entries (the substantive one).
    const best = [...res.bundles].sort((a, b) => b.entries.length - a.entries.length)[0];
    setChosenDate(best?.operationalDate ?? null);
  }

  async function onFiles(files: FileList): Promise<void> {
    setBusy(true);
    setError('');
    try {
      const next = [...loaded];
      for (const file of Array.from(files)) {
        const parsed = await parseOne(file);
        next.push({ fileName: file.name, bulletin: parsed });
      }
      recompute(next);
    } catch (e) {
      setError(`Could not parse file: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function parseOne(file: File): Promise<Bulletin> {
    const { parseDocx } = await import('@notam/parser');
    const buf = await file.arrayBuffer();
    const parsed = await parseDocx(buf);
    const notams = await resolveZones(parsed.notams);
    return { ...parsed, notams };
  }

  function loadDemo(): void {
    setError('');
    recompute([{ fileName: 'BNZ327.docx (demo)', bulletin: demoBulletin as unknown as Bulletin }]);
  }

  const chosen: ConsolidatedBundle | undefined = useMemo(
    () => result?.bundles.find((b) => b.operationalDate === chosenDate) ?? result?.bundles[0],
    [result, chosenDate],
  );

  function commit(): void {
    if (!result || !chosen) return;
    const otherDates = result.bundles
      .map((b) => b.operationalDate)
      .filter((d): d is string => !!d && d !== chosen.operationalDate);
    const { notams, summary } = buildLoadedBundle(chosen, otherDates);
    const baseDoc = chosen.documents.find((d) => d.kind === 'BASE');
    setData(
      notams,
      {
        bulletinNr: baseDoc?.bulletinNr ?? chosen.documents[0]?.bulletinNr ?? null,
        bulletinDate: chosen.operationalDate,
        source: 'BNLR',
      },
      summary,
    );
    onClose();
  }

  const dated = result?.bundles.filter((b) => b.operationalDate) ?? [];
  const activeCount = chosen
    ? chosen.entries.filter((e) => e.state !== 'superseded' && e.state !== 'cancelled').length
    : 0;

  return (
    <div className="ingest-overlay">
      <div className="ingest-modal">
        <header className="ingest-head">
          <h2>Load NOTAM bulletin bundle</h2>
          <button className="btn ghost" onClick={onClose}>
            ✕
          </button>
        </header>

        <div className="ingest-actions">
          <label className="btn primary">
            {busy ? 'Parsing…' : 'Choose .docx files…'}
            <input
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              hidden
              multiple
              onChange={(e) => e.target.files?.length && onFiles(e.target.files)}
            />
          </label>
          <button className="btn" onClick={loadDemo}>
            Load demo bulletin (BNZ 327)
          </button>
          {loaded.length > 0 && (
            <button className="btn ghost" onClick={() => recompute([])}>
              Clear
            </button>
          )}
          <span className="ingest-hint">
            Upload a base bulletin together with its supplements (COMPLETARE) and modifications
            (MODIFICARE) — all for the same date.
          </span>
        </div>

        {error && <div className="ingest-error">{error}</div>}

        {loaded.length > 0 && (
          <div className="bundle-files">
            {loaded.map((l, i) => (
              <span key={i} className="bundle-file-chip" title={l.fileName}>
                {l.fileName}
              </span>
            ))}
          </div>
        )}

        {result && chosen && (
          <>
            {dated.length > 1 && (
              <div className="bundle-dates">
                <span className="bundle-dates-warn" title={result.warnings.join('\n')}>
                  ⚠ The upload spans {dated.length} operational dates — pick one:
                </span>
                {dated.map((b) => (
                  <button
                    key={b.operationalDate}
                    className={`chip${b.operationalDate === chosen.operationalDate ? ' on' : ''}`}
                    onClick={() => setChosenDate(b.operationalDate)}
                  >
                    {b.operationalDate} ({b.entries.length})
                  </button>
                ))}
              </div>
            )}

            <div className="ingest-summary">
              <strong>{chosen.operationalDate ?? 'undated'}</strong> — {chosen.documents.length}{' '}
              document(s), {activeCount} active NOTAM(s).{' '}
              {Object.entries(buildCounts(chosen))
                .map(([s, n]) => `${n} ${STATE_LABEL[s] ?? s}`)
                .join(' · ')}
            </div>

            <div className="bundle-docs">
              {chosen.documents.map((d, i) => (
                <span key={i} className="bundle-doc">
                  {KIND_LABEL[d.kind] ?? d.kind}
                  {d.sequence != null ? ` ${d.sequence}` : ''} · NR. {d.bulletinNr ?? '?'} · issued{' '}
                  {d.issuedDate ?? '?'} · {d.entryCount} entries
                </span>
              ))}
            </div>

            {chosen.warnings.length > 0 && (
              <ul className="bundle-warnings">
                {chosen.warnings.map((w, i) => (
                  <li key={i}>⚠ {w}</li>
                ))}
              </ul>
            )}

            <div className="ingest-table-wrap">
              <table className="ingest-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Currency</th>
                    <th>Type</th>
                    <th>Lower</th>
                    <th>Upper</th>
                    <th>Schedule</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {chosen.entries.map((e, i) => (
                    <tr key={`${e.notam.id}#${i}`} className={`state-${e.state}`}>
                      <td>{e.notam.id}</td>
                      <td>
                        {STATE_LABEL[e.state] ?? e.state}
                        {e.relatedRef ? ` → ${e.relatedRef}` : ''}
                      </td>
                      <td>{e.notam.areaTypeRaw || e.notam.areaType}</td>
                      <td>{e.notam.lower.raw}</td>
                      <td>{e.notam.upper.raw}</td>
                      <td>{e.notam.schedules.map((s) => `${s.rawFrom}–${s.rawTo}`).join(', ')}</td>
                      <td title={e.notes.join('\n')}>{e.notes[0] ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <footer className="ingest-foot">
              <button className="btn primary" onClick={commit} disabled={activeCount === 0}>
                Load {activeCount} NOTAMs for {chosen.operationalDate ?? 'this bundle'} →
              </button>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}

function buildCounts(b: ConsolidatedBundle): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const e of b.entries) counts[e.state] = (counts[e.state] ?? 0) + 1;
  return counts;
}
