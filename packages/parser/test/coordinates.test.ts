import { describe, expect, it } from 'vitest';
import {
  coordsToRing,
  extractCoords,
  parseGeometryFromText,
  parseRadiusMeters,
} from '../src/coordinates.js';

describe('extractCoords', () => {
  it('parses a spaced DMS pair', () => {
    const [c] = extractCoords('45 52 25N/022 53 59E');
    expect(c.lat).toBeCloseTo(45 + 52 / 60 + 25 / 3600, 5);
    expect(c.lon).toBeCloseTo(22 + 53 / 60 + 59 / 3600, 5);
  });

  it('parses a no-space DMS group (474610N)', () => {
    const [c] = extractCoords('474610N/023 45 13E');
    expect(c.lat).toBeCloseTo(47 + 46 / 60 + 10 / 3600, 5);
    expect(c.lon).toBeCloseTo(23 + 45 / 60 + 13 / 3600, 5);
  });

  it('tolerates stray spaces around hemisphere and slash', () => {
    const [c] = extractCoords('44 17 19 N/ 023 42 54E');
    expect(c.lat).toBeCloseTo(44 + 17 / 60 + 19 / 3600, 5);
  });
});

describe('parseRadiusMeters', () => {
  it('converts NM', () => expect(parseRadiusMeters('R=6NM')).toBeCloseTo(11112));
  it('converts KM with spaces', () => expect(parseRadiusMeters('R = 5 KM')).toBe(5000));
  it('returns null when absent', () => expect(parseRadiusMeters('no radius here')).toBeNull());
});

describe('parseGeometryFromText', () => {
  it('builds a closed polygon from a 4-vertex list (F6031)', () => {
    const text =
      'Zona CORIDOR SAVARSIN-DEVA POLIGON 3, de coordonate: ' +
      '45 52 25N/022 53 59E – 45 53 25N/022 55 58E – 45 58 34N/022 49 01E – 45 56 54N/022 48 31E.';
    const { geometry } = parseGeometryFromText(text);
    expect(geometry?.type).toBe('Polygon');
    const ring = (geometry as GeoJSON.Polygon).coordinates[0];
    expect(ring).toHaveLength(5); // 4 vertices + closing point
    expect(ring[0]).toEqual(ring[4]);
  });

  it('builds a circle polygon from center + R=6NM (B7076)', () => {
    const { geometry, circle } = parseGeometryFromText('44 18 00N/025 56 00E, R=6NM.');
    expect(geometry?.type).toBe('Polygon');
    expect(circle?.radiusMeters).toBeCloseTo(11112);
    expect(circle?.centerLat).toBeCloseTo(44.3, 1);
  });

  it('builds a polygon from named-vertex form (B7234)', () => {
    const text =
      'TARG(44 18 02N/023 47 17E) - DEDEMAN(44 17 26N/023 50 50E) - PREAJBA(44 15 52N/023 50 54E) – ' +
      'PODARI(44 14 22N/023 47 04E) – BUCOVAT( 44 17 19 N/ 023 42 54E) – CATARGIU SUD(44 18 01N/023 46 27E).';
    const { geometry } = parseGeometryFromText(text);
    const ring = (geometry as GeoJSON.Polygon).coordinates[0];
    expect(ring).toHaveLength(7); // 6 vertices + closing
  });

  it('returns null geometry when no coordinates present', () => {
    const { geometry } = parseGeometryFromText('LRTRA 28 G LRTRA 28 L LRTRA 28 M');
    expect(geometry).toBeNull();
  });

  it('models a "N NM S/D" corridor as a buffered centre line, not a bow-tie', () => {
    // Out-and-back route (A→B→C→B→A) with a 5 NM each-side width.
    const text =
      'A(45 00 00N/026 00 00E) - B(45 30 00N/026 30 00E) - C(46 00 00N/027 00 00E) - ' +
      'B(45 30 00N/026 30 00E) - A(45 00 00N/026 00 00E), 5 NM S/D';
    const { geometry } = parseGeometryFromText(text);
    expect(geometry).not.toBeNull();
    expect(['Polygon', 'MultiPolygon']).toContain(geometry!.type);
    // A buffered corridor has many rounded vertices — not the 5-point raw ring.
    if (geometry!.type === 'Polygon') {
      expect((geometry as GeoJSON.Polygon).coordinates[0].length).toBeGreaterThan(5);
    }
  });
});

describe('coordsToRing', () => {
  const c = (lat: number, lon: number) => ({ lat, lon });

  it('truncates at the closing vertex, dropping trailing coordinates', () => {
    // v0, v1, v2, v0(closes) then a stray "Note" coordinate that must be ignored.
    const ring = coordsToRing([c(45, 25), c(46, 25), c(46, 26), c(45, 25), c(40, 20)]);
    expect(ring).toEqual([
      [25, 45],
      [25, 46],
      [26, 46],
      [25, 45],
    ]);
  });

  it('closes an open ring and drops consecutive duplicates', () => {
    const ring = coordsToRing([c(45, 25), c(45, 25), c(46, 25), c(46, 26)]);
    expect(ring[0]).toEqual(ring[ring.length - 1]); // closed
    expect(ring).toHaveLength(4); // dup dropped: (25,45),(25,46),(26,46),(25,45)
  });
});
