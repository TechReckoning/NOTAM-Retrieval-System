import type { Activity, AreaType } from '@notam/parser';
import { ACTIVITY_LABELS, AREA_TYPE_LABELS } from '@notam/parser';
import { FL_CEILING, FL_FLOOR } from '../lib/filter';
import { AREA_TYPES } from '../lib/types';
import { useStore } from '../state/store';

const ACTIVITIES = Object.keys(ACTIVITY_LABELS) as Activity[];

function flLabel(feet: number): string {
  if (feet <= 0) return 'GND';
  if (feet >= FL_CEILING) return `FL${FL_CEILING / 100}`;
  return `FL${Math.round(feet / 100)}`;
}

/** datetime-local <-> stored UTC ISO ("...Z") helpers. */
const toInput = (iso: string): string => (iso ? iso.replace('Z', '').slice(0, 16) : '');
const fromInput = (v: string): string => (v ? `${v}:00Z` : '');

export function Filters(): JSX.Element {
  const filters = useStore((s) => s.filters);
  const toggleAreaType = useStore((s) => s.toggleAreaType);
  const toggleActivity = useStore((s) => s.toggleActivity);
  const setFlRange = useStore((s) => s.setFlRange);
  const setTime = useStore((s) => s.setTime);
  const setDrawMode = useStore((s) => s.setDrawMode);
  const setDrawnArea = useStore((s) => s.setDrawnArea);
  const drawMode = useStore((s) => s.drawMode);
  const resetFilters = useStore((s) => s.resetFilters);

  return (
    <div className="filters">
      <section>
        <h3>NOTAM type</h3>
        <div className="chips">
          {AREA_TYPES.map((t: AreaType) => (
            <button
              key={t}
              className={`chip${filters.areaTypes.has(t) ? ' on' : ''}`}
              onClick={() => toggleAreaType(t)}
            >
              {AREA_TYPE_LABELS[t] ?? t}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3>Activity</h3>
        <div className="chips">
          {ACTIVITIES.map((a) => (
            <button
              key={a}
              className={`chip${filters.activities.has(a) ? ' on' : ''}`}
              onClick={() => toggleActivity(a)}
            >
              {ACTIVITY_LABELS[a]}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3>
          Flight level <span className="muted">{flLabel(filters.flMin)} – {flLabel(filters.flMax)}</span>
        </h3>
        <div className="range-row">
          <input
            type="range"
            min={FL_FLOOR}
            max={FL_CEILING}
            step={500}
            value={filters.flMin}
            onChange={(e) => setFlRange(Math.min(+e.target.value, filters.flMax), filters.flMax)}
          />
          <input
            type="range"
            min={FL_FLOOR}
            max={FL_CEILING}
            step={500}
            value={filters.flMax}
            onChange={(e) => setFlRange(filters.flMin, Math.max(+e.target.value, filters.flMin))}
          />
        </div>
      </section>

      <section>
        <h3>Active during (UTC)</h3>
        <div className="time-row">
          <label>
            From
            <input
              type="datetime-local"
              value={toInput(filters.timeFrom)}
              onChange={(e) => setTime(fromInput(e.target.value), filters.timeTo)}
            />
          </label>
          <label>
            To
            <input
              type="datetime-local"
              value={toInput(filters.timeTo)}
              onChange={(e) => setTime(filters.timeFrom, fromInput(e.target.value))}
            />
          </label>
        </div>
      </section>

      <section>
        <h3>Area of interest</h3>
        <div className="aoi-row">
          <button className={`btn${drawMode ? ' on' : ''}`} onClick={() => setDrawMode(!drawMode)}>
            {drawMode ? 'Click-drag on map…' : 'Draw rectangle'}
          </button>
          <button className="btn" disabled={!filters.drawnArea} onClick={() => setDrawnArea(null)}>
            Clear area
          </button>
        </div>
      </section>

      <button className="btn reset" onClick={resetFilters}>
        Reset all filters
      </button>
    </div>
  );
}
