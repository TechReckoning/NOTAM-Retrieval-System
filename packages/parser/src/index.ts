/** Public API of the @notam/parser package. */

export * from './types.js';
export { parseGeometryFromText, extractCoords, parseRadiusMeters } from './coordinates.js';
export { parseVerticalLimit } from './verticalLimits.js';
export { buildSchedules, extractTimes } from './schedule.js';
export {
  classifyAreaType,
  classifyActivities,
  extractZoneRefs,
  extractCoordUnits,
  extractNotamId,
  extractContact,
} from './classify.js';
export {
  assembleNotam,
  detectColumns,
  DEFAULT_COLUMNS,
  type RawRow,
  type ColumnMap,
} from './notam.js';
export { parseDocx, parseHtmlBulletin, parseHeader } from './docx.js';
export {
  applyGazetteer,
  resolveGeometry,
  buildZoneIndex,
  normalizeDesignator,
  type ZoneIndex,
} from './zones.js';
export { bucketByAreas, type AreaPolygon, type BucketResult } from './spatial.js';

/** Human-readable labels for the model enums (shared by UI). */
export const AREA_TYPE_LABELS: Record<string, string> = {
  TEMP_RESERVED: 'Temporary Reserved (TRA)',
  TEMP_SEGREGATED: 'Temporary Segregated (TSA)',
  DANGER: 'Danger Area',
  WARNING: 'Warning Area',
  UNKNOWN: 'Unknown',
};

export const ACTIVITY_LABELS: Record<string, string> = {
  MIL_TRAINING: 'Military training',
  UAV: 'UAV',
  SPORT: 'Sport flying',
  PARACHUTING: 'Parachuting',
  GLIDER: 'Glider',
  PARAGLIDER: 'Paraglider',
  AERIAL_PHOTO: 'Aerial photography',
  OTHER: 'Other',
};
