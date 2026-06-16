import type { AreaType } from '@notam/parser';

/** Map color per area type — distinct, aviation-chart-inspired hues. */
export const AREA_COLORS: Record<AreaType, string> = {
  DANGER: '#e23b3b', // red
  WARNING: '#e6932b', // amber
  TEMP_RESERVED: '#3b7de2', // blue
  TEMP_SEGREGATED: '#8b5cf6', // violet
  UNKNOWN: '#7a8699', // grey
};

export function areaColor(type: AreaType): string {
  return AREA_COLORS[type] ?? AREA_COLORS.UNKNOWN;
}
