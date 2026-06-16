import bbox from '@turf/bbox';
import { ACTIVITY_LABELS, AREA_TYPE_LABELS } from '@notam/parser';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Feature, FeatureCollection, Polygon } from 'geojson';
import { useEffect, useRef } from 'react';
import { areaColor } from '../lib/colors';
import type { LoadedNotam } from '../lib/types';
import { useStore } from '../state/store';
import { getStyle, INITIAL_VIEW } from './style';

interface Props {
  visible: LoadedNotam[];
}

/** Build the GeoJSON the map renders — only NOTAMs that have geometry. */
function toFeatureCollection(notams: LoadedNotam[]): FeatureCollection {
  const features: Feature[] = notams
    .filter((n) => n.geometry)
    .map((n) => ({
      type: 'Feature',
      id: n.uid,
      properties: {
        uid: n.uid,
        id: n.id,
        color: areaColor(n.areaType),
      },
      geometry: n.geometry!,
    }));
  return { type: 'FeatureCollection', features };
}

function popupHtml(n: LoadedNotam): string {
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
  const acts = n.activities.map((a) => ACTIVITY_LABELS[a] ?? a).join(', ');
  const sched = n.schedules
    .map((s) => `${s.rawFrom}–${s.rawTo}`)
    .join(', ');
  return `
    <div class="popup">
      <div class="popup-id" style="border-color:${areaColor(n.areaType)}">${esc(n.id)}</div>
      <div class="popup-type">${AREA_TYPE_LABELS[n.areaType] ?? n.areaType}</div>
      <div class="popup-title">${esc(n.title || '')}</div>
      <table>
        <tr><th>Activity</th><td>${esc(acts)}</td></tr>
        <tr><th>Limits</th><td>${esc(n.lower.raw)} – ${esc(n.upper.raw)}</td></tr>
        <tr><th>Schedule</th><td>${esc(sched)} UTC</td></tr>
        ${n.contact ? `<tr><th>Contact</th><td>${esc(n.contact)}</td></tr>` : ''}
      </table>
    </div>`;
}

export function MapView({ visible }: Props): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const loadedRef = useRef(false);
  const prevSelected = useRef<string | null>(null);
  const prevHovered = useRef<string | null>(null);

  // Keep a ref to the current visible set for event handlers (avoid stale closures).
  const visibleRef = useRef<LoadedNotam[]>(visible);
  visibleRef.current = visible;

  // --- create map once ---
  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: getStyle(),
      center: INITIAL_VIEW.center,
      zoom: INITIAL_VIEW.zoom,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

    map.on('load', () => {
      map.addSource('notams', { type: 'geojson', data: emptyFc(), promoteId: 'uid' });
      map.addSource('aoi', { type: 'geojson', data: emptyFc() });

      map.addLayer({
        id: 'notam-fill',
        type: 'fill',
        source: 'notams',
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            0.5,
            ['boolean', ['feature-state', 'hovered'], false],
            0.38,
            0.2,
          ],
        },
      });
      map.addLayer({
        id: 'notam-outline',
        type: 'line',
        source: 'notams',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['case', ['boolean', ['feature-state', 'selected'], false], 3.5, 1.5],
        },
      });
      // Area-of-interest rectangle.
      map.addLayer({
        id: 'aoi-fill',
        type: 'fill',
        source: 'aoi',
        paint: { 'fill-color': '#00e0ff', 'fill-opacity': 0.08 },
      });
      map.addLayer({
        id: 'aoi-line',
        type: 'line',
        source: 'aoi',
        paint: { 'line-color': '#00e0ff', 'line-width': 1.5, 'line-dasharray': [2, 2] },
      });

      loadedRef.current = true;
      (map.getSource('notams') as maplibregl.GeoJSONSource).setData(
        toFeatureCollection(visibleRef.current),
      );
    });

    // Click a NOTAM -> select + popup.
    map.on('click', 'notam-fill', (e) => {
      const uid = e.features?.[0]?.properties?.uid as string | undefined;
      if (!uid) return;
      const notam = visibleRef.current.find((n) => n.uid === uid);
      if (!notam) return;
      useStore.getState().select(uid);
      popupRef.current?.remove();
      popupRef.current = new maplibregl.Popup({ closeButton: true, maxWidth: '320px' })
        .setLngLat(e.lngLat)
        .setHTML(popupHtml(notam))
        .addTo(map);
    });
    map.on('mousemove', 'notam-fill', (e) => {
      map.getCanvas().style.cursor = 'pointer';
      const uid = e.features?.[0]?.properties?.uid as string | undefined;
      useStore.getState().hover(uid ?? null);
    });
    map.on('mouseleave', 'notam-fill', () => {
      map.getCanvas().style.cursor = '';
      useStore.getState().hover(null);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
  }, []);

  // --- update rendered features when the visible set changes ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    (map.getSource('notams') as maplibregl.GeoJSONSource | undefined)?.setData(
      toFeatureCollection(visible),
    );
  }, [visible]);

  // --- reflect selection: highlight + fly to ---
  const selectedUid = useStore((s) => s.selectedUid);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    if (prevSelected.current) {
      map.setFeatureState({ source: 'notams', id: prevSelected.current }, { selected: false });
    }
    if (selectedUid) {
      map.setFeatureState({ source: 'notams', id: selectedUid }, { selected: true });
      const notam = visibleRef.current.find((n) => n.uid === selectedUid);
      if (notam?.geometry) {
        const [minX, minY, maxX, maxY] = bbox(notam.geometry);
        map.fitBounds(
          [
            [minX, minY],
            [maxX, maxY],
          ],
          { padding: 80, maxZoom: 11, duration: 600 },
        );
      }
    }
    prevSelected.current = selectedUid;
  }, [selectedUid]);

  // --- reflect hover ---
  const hoveredUid = useStore((s) => s.hoveredUid);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    if (prevHovered.current) {
      map.setFeatureState({ source: 'notams', id: prevHovered.current }, { hovered: false });
    }
    if (hoveredUid) {
      map.setFeatureState({ source: 'notams', id: hoveredUid }, { hovered: true });
    }
    prevHovered.current = hoveredUid;
  }, [hoveredUid]);

  // --- area-of-interest drawing (drag a rectangle) ---
  const drawMode = useStore((s) => s.drawMode);
  const drawnArea = useStore((s) => s.filters.drawnArea);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const src = map.getSource('aoi') as maplibregl.GeoJSONSource | undefined;
    if (drawnArea) src?.setData({ type: 'Feature', properties: {}, geometry: drawnArea } as Feature);
    else src?.setData(emptyFc());
  }, [drawnArea]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    if (!drawMode) return;

    map.getCanvas().style.cursor = 'crosshair';
    map.dragPan.disable();
    let start: maplibregl.LngLat | null = null;
    const src = () => map.getSource('aoi') as maplibregl.GeoJSONSource | undefined;

    const rect = (a: maplibregl.LngLat, b: maplibregl.LngLat): Polygon => ({
      type: 'Polygon',
      coordinates: [
        [
          [a.lng, a.lat],
          [b.lng, a.lat],
          [b.lng, b.lat],
          [a.lng, b.lat],
          [a.lng, a.lat],
        ],
      ],
    });

    const onDown = (e: maplibregl.MapMouseEvent) => {
      start = e.lngLat;
    };
    const onMove = (e: maplibregl.MapMouseEvent) => {
      if (!start) return;
      src()?.setData({ type: 'Feature', properties: {}, geometry: rect(start, e.lngLat) } as Feature);
    };
    const onUp = (e: maplibregl.MapMouseEvent) => {
      if (!start) return;
      const poly = rect(start, e.lngLat);
      start = null;
      useStore.getState().setDrawnArea(poly);
    };

    map.on('mousedown', onDown);
    map.on('mousemove', onMove);
    map.on('mouseup', onUp);

    return () => {
      map.off('mousedown', onDown);
      map.off('mousemove', onMove);
      map.off('mouseup', onUp);
      map.getCanvas().style.cursor = '';
      map.dragPan.enable();
    };
  }, [drawMode]);

  return <div ref={containerRef} className="map-container" />;
}

function emptyFc(): FeatureCollection {
  return { type: 'FeatureCollection', features: [] };
}
