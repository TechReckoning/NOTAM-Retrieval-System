import { ACTIVITY_LABELS, AREA_TYPE_LABELS } from '@notam/parser';
import { useState } from 'react';
import { areaColor } from '../lib/colors';
import type { LoadedNotam } from '../lib/types';

interface Props {
  notam: LoadedNotam;
}

/** A NOTAM row for List View Mode that expands inline to show full detail. */
export function NotamCard({ notam: n }: Props): JSX.Element {
  const [open, setOpen] = useState(false);
  const color = areaColor(n.areaType);

  return (
    <li className={`notam-card${open ? ' open' : ''}`} style={{ borderLeftColor: color }}>
      <button className="card-head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="row-id" style={{ background: color }}>
          {n.id}
        </span>
        <span className="row-type">{AREA_TYPE_LABELS[n.areaType] ?? n.areaType}</span>
        <span className="card-caret">{open ? '▾' : '▸'}</span>
      </button>

      <div className="card-summary">
        <span>{n.activities.map((a) => ACTIVITY_LABELS[a] ?? a).join(', ')}</span>
        <span className="row-limits">
          {n.lower.raw} – {n.upper.raw}
        </span>
      </div>

      {open && (
        <div className="card-detail">
          {n.title && <div className="detail-title">{n.title}</div>}
          <table>
            <tbody>
              <tr>
                <th>Schedule</th>
                <td>
                  {n.schedules.map((s) => `${s.rawFrom}–${s.rawTo}`).join(', ') || '—'} UTC
                </td>
              </tr>
              {n.zoneRefs.length > 0 && (
                <tr>
                  <th>Zones</th>
                  <td>{n.zoneRefs.join(', ')}</td>
                </tr>
              )}
              {n.coordUnits.length > 0 && (
                <tr>
                  <th>Coordination</th>
                  <td>{n.coordUnits.join(', ')}</td>
                </tr>
              )}
              {n.contact && (
                <tr>
                  <th>Contact</th>
                  <td>{n.contact}</td>
                </tr>
              )}
              <tr>
                <th>Geometry</th>
                <td>{n.geometrySource}</td>
              </tr>
            </tbody>
          </table>
          {n.description && <div className="detail-desc">{n.description}</div>}
          {n.warnings.length > 0 && (
            <div className="detail-warn">⚠ {n.warnings.join(' · ')}</div>
          )}
        </div>
      )}
    </li>
  );
}
