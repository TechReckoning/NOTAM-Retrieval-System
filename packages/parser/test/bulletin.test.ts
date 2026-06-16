import { describe, expect, it } from 'vitest';
import { parseHtmlBulletin } from '../src/docx.js';
import { applyGazetteer } from '../src/zones.js';
import type { FeatureCollection, Polygon } from 'geojson';

/** A tiny but representative bulletin in the HTML shape mammoth produces. */
const HTML = `
<p>BNLR</p>
<p>BAZA NOTAM NR. 327 PENTRU 17.06.2026</p>
<p>EMISĂ LA 16.06.2026</p>
<table>
<tr><td>Nr. crt.</td><td>Tip</td><td>Denumire, Descriere</td><td>Activitate</td><td>Limita inf</td><td>Limita sup</td><td>De la UTC</td><td>Pana la UTC</td><td>Obs.</td></tr>
<tr>
  <td>F6031</td><td>ZONA AVERTISM.</td>
  <td>Zona CORIDOR SAVARSIN-DEVA POLIGON 3, de coordonate: 45 52 25N/022 53 59E – 45 53 25N/022 55 58E – 45 58 34N/022 49 01E – 45 56 54N/022 48 31E.</td>
  <td>ZBOR UAV</td><td>GND</td><td>1.200 FT AMSL</td><td>DD 06.00</td><td>DD 16.00</td><td></td>
</tr>
<tr>
  <td>C9527</td><td>ZONA TEMP. REZ.</td>
  <td>LRTRA 28 G LRTRA 28 L LRTRA 28 M</td>
  <td>ZBOR DE ANTR. CU AERON. MIL</td><td>GND</td><td>FL 280</td><td>DD 06.00</td><td>DD 16.00</td><td>LRCT</td>
</tr>
</table>
`;

describe('parseHtmlBulletin', () => {
  const bulletin = parseHtmlBulletin(HTML);

  it('reads bulletin header metadata', () => {
    expect(bulletin.bulletinNr).toBe(327);
    expect(bulletin.bulletinDate).toBe('2026-06-17');
    expect(bulletin.issuedDate).toBe('2026-06-16');
    expect(bulletin.source).toBe('BNLR');
  });

  it('parses both NOTAM rows', () => {
    expect(bulletin.notams.map((n) => n.id)).toEqual(['F6031', 'C9527']);
  });

  it('inline-coordinate NOTAM gets a polygon', () => {
    const f = bulletin.notams[0];
    expect(f.geometrySource).toBe('inline');
    expect(f.geometry?.type).toBe('Polygon');
    expect(f.areaType).toBe('WARNING');
    expect(f.activities).toEqual(['UAV']);
    expect(f.lower.feet).toBe(0);
    expect(f.upper.feet).toBe(1200);
    expect(f.schedules[0].fromUTC).toBe('2026-06-17T06:00:00.000Z');
  });

  it('named-zone NOTAM is geometry-pending with zoneRefs', () => {
    const c = bulletin.notams[1];
    expect(c.geometry).toBeNull();
    expect(c.geometrySource).toBe('none');
    expect(c.zoneRefs).toEqual(['LRTRA 28 G', 'LRTRA 28 L', 'LRTRA 28 M']);
    expect(c.coordUnits).toEqual(['LRCT']);
    expect(c.warnings.join(' ')).toMatch(/geometry pending/);
  });
});

describe('applyGazetteer', () => {
  it('resolves named zones once geometry is supplied', () => {
    const bulletin = parseHtmlBulletin(HTML);
    const gazetteer: FeatureCollection<Polygon, { designator: string }> = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { designator: 'LRTRA 28 G' },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [24, 45],
                [24.1, 45],
                [24.1, 45.1],
                [24, 45.1],
                [24, 45],
              ],
            ],
          },
        },
      ],
    };
    const resolved = applyGazetteer(bulletin.notams, gazetteer);
    const c = resolved.find((n) => n.id === 'C9527')!;
    expect(c.geometrySource).toBe('gazetteer');
    expect(c.geometry?.type).toBe('Polygon');
    // Two of the three sub-zones remain unknown -> flagged.
    expect(c.warnings.join(' ')).toMatch(/not in gazetteer/);
  });
});
