import { describe, expect, it } from 'vitest';
import { bucketByAreas, type AreaPolygon } from '../src/spatial.js';
import type { Geometry } from 'geojson';

/** Two non-overlapping square areas. */
const AREAS: AreaPolygon[] = [
  {
    id: 'A',
    geometry: {
      type: 'Polygon',
      coordinates: [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]],
    },
  },
  {
    id: 'B',
    geometry: {
      type: 'Polygon',
      coordinates: [[[10, 10], [12, 10], [12, 12], [10, 12], [10, 10]]],
    },
  },
];

function poly(coords: number[][]): Geometry {
  return { type: 'Polygon', coordinates: [coords] };
}

describe('bucketByAreas', () => {
  it('places an item in the single area it intersects', () => {
    const items = [{ id: 'in-A', geometry: poly([[0.5, 0.5], [1, 0.5], [1, 1], [0.5, 1], [0.5, 0.5]]) }];
    const r = bucketByAreas(items, AREAS);
    expect(r.byArea.A.map((i) => i.id)).toEqual(['in-A']);
    expect(r.byArea.B).toEqual([]);
    expect(r.outside).toEqual([]);
  });

  it('places an item that straddles two areas in both', () => {
    // A big polygon covering both squares.
    const items = [{ id: 'both', geometry: poly([[-1, -1], [13, -1], [13, 13], [-1, 13], [-1, -1]]) }];
    const r = bucketByAreas(items, AREAS);
    expect(r.byArea.A.map((i) => i.id)).toEqual(['both']);
    expect(r.byArea.B.map((i) => i.id)).toEqual(['both']);
    expect(r.outside).toEqual([]);
  });

  it('reports items with geometry but outside every area', () => {
    const items = [{ id: 'far', geometry: poly([[50, 50], [51, 50], [51, 51], [50, 51], [50, 50]]) }];
    const r = bucketByAreas(items, AREAS);
    expect(r.outside.map((i) => i.id)).toEqual(['far']);
    expect(r.byArea.A).toEqual([]);
  });

  it('separates items with no geometry', () => {
    const items = [{ id: 'pending', geometry: null }];
    const r = bucketByAreas(items, AREAS);
    expect(r.noGeometry.map((i) => i.id)).toEqual(['pending']);
    expect(r.outside).toEqual([]);
  });
});
