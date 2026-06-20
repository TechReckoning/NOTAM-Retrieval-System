import type { Activity, AreaType } from '@notam/parser';
import type { Polygon } from 'geojson';
import { create } from 'zustand';
import { defaultFilters, type FilterState } from '../lib/filter';
import type { LoadedNotam } from '../lib/types';

export interface BulletinMeta {
  bulletinNr: number | null;
  bulletinDate: string | null;
  source: string | null;
}

export type ViewMode = 'map' | 'list';

interface AppState {
  notams: LoadedNotam[];
  meta: BulletinMeta | null;
  /** Map View (map + synchronized list) or List View (per-TMA briefing lists). */
  viewMode: ViewMode;
  filters: FilterState;
  selectedUid: string | null;
  hoveredUid: string | null;
  /** When true, the next map drag defines the area-of-interest rectangle. */
  drawMode: boolean;
  /** Which area-of-interest is active: a TMA id, 'custom' (drawn), or null. */
  areaPresetId: string | null;
  /** Operational time (ISO UTC) used for the Active/Upcoming/Expired lens. */
  opTime: string;
  /** When true, hide NOTAMs that are not active at the operational time. */
  activeOnly: boolean;

  setData: (notams: LoadedNotam[], meta: BulletinMeta) => void;
  setViewMode: (mode: ViewMode) => void;
  setOpTime: (iso: string) => void;
  setActiveOnly: (on: boolean) => void;
  select: (uid: string | null) => void;
  hover: (uid: string | null) => void;
  toggleAreaType: (t: AreaType) => void;
  toggleActivity: (a: Activity) => void;
  setFlRange: (min: number, max: number) => void;
  setTime: (from: string, to: string) => void;
  setDrawnArea: (poly: Polygon | null) => void;
  /** Apply a predefined area-of-interest (e.g. a TMA) by id + geometry + vertical slab. */
  setAreaPreset: (id: string, poly: Polygon, floorFt: number, ceilingFt: number) => void;
  setDrawMode: (on: boolean) => void;
  resetFilters: () => void;
}

function toggle<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

/** Default operational time: the bulletin's date at the current UTC time-of-day. */
function defaultOpTime(bulletinDate: string | null): string {
  const now = new Date();
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const mm = String(now.getUTCMinutes()).padStart(2, '0');
  return bulletinDate
    ? `${bulletinDate}T${hh}:${mm}:00Z`
    : `${now.toISOString().slice(0, 16)}:00Z`;
}

export const useStore = create<AppState>((set) => ({
  notams: [],
  meta: null,
  viewMode: 'map',
  filters: defaultFilters(),
  selectedUid: null,
  hoveredUid: null,
  drawMode: false,
  areaPresetId: null,
  opTime: defaultOpTime(null),
  activeOnly: false,

  setData: (notams, meta) =>
    set({ notams, meta, selectedUid: null, opTime: defaultOpTime(meta.bulletinDate) }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setOpTime: (iso) => set({ opTime: iso }),
  setActiveOnly: (on) => set({ activeOnly: on }),
  select: (uid) => set({ selectedUid: uid }),
  hover: (uid) => set({ hoveredUid: uid }),

  toggleAreaType: (t) =>
    set((s) => ({ filters: { ...s.filters, areaTypes: toggle(s.filters.areaTypes, t) } })),
  toggleActivity: (a) =>
    set((s) => ({ filters: { ...s.filters, activities: toggle(s.filters.activities, a) } })),
  setFlRange: (min, max) => set((s) => ({ filters: { ...s.filters, flMin: min, flMax: max } })),
  setTime: (from, to) => set((s) => ({ filters: { ...s.filters, timeFrom: from, timeTo: to } })),
  setDrawnArea: (poly) =>
    set((s) => ({
      // Custom drawn area is lateral only — clear any TMA vertical slab / allocation.
      filters: {
        ...s.filters,
        drawnArea: poly,
        areaFloorFt: null,
        areaCeilingFt: null,
        areaTmaId: null,
      },
      drawMode: false,
      areaPresetId: poly ? 'custom' : null,
    })),
  setAreaPreset: (id, poly, floorFt, ceilingFt) =>
    set((s) => ({
      filters: {
        ...s.filters,
        drawnArea: poly,
        areaFloorFt: floorFt,
        areaCeilingFt: ceilingFt,
        areaTmaId: id,
      },
      drawMode: false,
      areaPresetId: id,
    })),
  setDrawMode: (on) => set({ drawMode: on }),
  resetFilters: () => set({ filters: defaultFilters(), areaPresetId: null }),
}));
