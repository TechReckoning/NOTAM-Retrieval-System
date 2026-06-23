import { ACTIVITY_LABELS, AREA_TYPE_LABELS, type ActivationStatus } from '@notam/parser';
import { useState } from 'react';
import { areaColor } from '../lib/colors';
import { STATUS_COLOR, STATUS_LABEL } from '../lib/status';
import type { LoadedNotam } from '../lib/types';

/** Why a NOTAM appears in a TMA column: inside the boundary, within the 5 NM
 *  buffer, or allocated by decree. */
export type Basis = 'in' | 'buffer' | 'allocated';

interface Props {
  notam: LoadedNotam;
  basis?: Basis;
  status?: ActivationStatus;
  overlapCount?: number;
}

/** A NOTAM row for List View Mode that expands inline to show full detail. */
export function NotamCard({ notam: n, basis, status, overlapCount = 0 }: Props): JSX.Element {
  const [open, setOpen] = useState(false);
  const color = areaColor(n.areaType);

  return (
    <li
      className={`notam-card${open ? ' open' : ''}${status ? ` status-${status}` : ''}`}
      style={{ borderLeftColor: color }}
    >
      <button className="card-head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {status && (
          <span
            className="status-dot"
            style={{ background: STATUS_COLOR[status] }}
            title={STATUS_LABEL[status]}
          />
        )}
        <span className="row-id" style={{ background: color }}>
          {n.id}
        </span>
        <span className="row-type">{AREA_TYPE_LABELS[n.areaType] ?? n.areaType}</span>
        {basis === 'allocated' && (
          <span className="basis-badge allocated" title="Allocated to this TMA (outside its boundary)">
            allocated
          </span>
        )}
        {basis === 'buffer' && (
          <span className="basis-badge buffer" title="Within the 5 NM buffer around this TMA">
            Within 5 NM
          </span>
        )}
        {basis === 'in' && (
          <span className="basis-badge inside" title="Geometrically inside this TMA boundary">
            in TMA
          </span>
        )}
        {overlapCount > 0 && (
          <span className="overlap-flag" title={`Overlaps ${overlapCount} other active NOTAM(s)`}>
            ⧉ {overlapCount}
          </span>
        )}
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
                <th>Limits</th>
                <td>
                  {n.lower.raw} – {n.upper.raw}
                  {(n.lower.original || n.upper.original) && (
                    <span className="detail-src">
                      {' '}
                      (source: {n.lower.original ?? n.lower.raw} –{' '}
                      {n.upper.original ?? n.upper.raw})
                    </span>
                  )}
                </td>
              </tr>
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
