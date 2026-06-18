import { ACTIVITY_LABELS, AREA_TYPE_LABELS } from '@notam/parser';
import { useEffect, useRef } from 'react';
import { tmasForNotam } from '../lib/allocations';
import { areaColor } from '../lib/colors';
import type { LoadedNotam } from '../lib/types';
import { useStore } from '../state/store';

interface Props {
  visible: LoadedNotam[];
  hiddenNoGeometry: number;
}

export function NotamList({ visible, hiddenNoGeometry }: Props): JSX.Element {
  const selectedUid = useStore((s) => s.selectedUid);
  const select = useStore((s) => s.select);
  const hover = useStore((s) => s.hover);
  const rowRefs = useRef<Map<string, HTMLLIElement>>(new Map());

  // When selection changes (e.g. from a map click), scroll the list to it.
  useEffect(() => {
    if (!selectedUid) return;
    rowRefs.current.get(selectedUid)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selectedUid]);

  return (
    <div className="list-panel">
      <div className="list-header">
        <strong>{visible.length}</strong> NOTAM{visible.length === 1 ? '' : 's'}
        {hiddenNoGeometry > 0 && (
          <span className="list-note" title="Excluded by the drawn area because they have no geometry yet">
            · {hiddenNoGeometry} no-geometry hidden
          </span>
        )}
      </div>
      <ul className="list-scroll">
        {visible.map((n) => {
          const color = areaColor(n.areaType);
          const pending = !n.geometry;
          const tmas = tmasForNotam(n);
          return (
            <li
              key={n.uid}
              ref={(el) => {
                if (el) rowRefs.current.set(n.uid, el);
                else rowRefs.current.delete(n.uid);
              }}
              className={`notam-row${n.uid === selectedUid ? ' selected' : ''}`}
              style={{ borderLeftColor: color }}
              onClick={() => select(n.uid)}
              onMouseEnter={() => hover(n.uid)}
              onMouseLeave={() => hover(null)}
            >
              <div className="row-top">
                <span className="row-id" style={{ background: color }}>
                  {n.id}
                </span>
                <span className="row-type">{AREA_TYPE_LABELS[n.areaType] ?? n.areaType}</span>
                {tmas.map((t) => (
                  <span key={t.id} className="tma-tag" title={`Allocated to ${t.name}`}>
                    {t.name}
                  </span>
                ))}
                {pending && <span className="row-pending" title="Geometry pending gazetteer">⚑ no map</span>}
              </div>
              {n.title && <div className="row-title">{n.title}</div>}
              <div className="row-meta">
                <span>{n.activities.map((a) => ACTIVITY_LABELS[a] ?? a).join(', ')}</span>
                <span className="row-limits">
                  {n.lower.raw} – {n.upper.raw}
                </span>
              </div>
              <div className="row-sched">
                {n.schedules.map((s, i) => (
                  <span key={i}>
                    {s.rawFrom}–{s.rawTo}
                  </span>
                ))}{' '}
                UTC
              </div>
            </li>
          );
        })}
        {visible.length === 0 && <li className="empty">No NOTAMs match the current filters.</li>}
      </ul>
    </div>
  );
}
