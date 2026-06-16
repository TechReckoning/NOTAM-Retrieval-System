import { describe, expect, it } from 'vitest';
import { buildSchedules, extractTimes } from '../src/schedule.js';

const DATE = '2026-06-17';

describe('extractTimes', () => {
  it('parses a single DD HH.MM line', () => {
    const t = extractTimes('DD 08.00');
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ hour: 8, minute: 0 });
  });

  it('parses multiple lines', () => {
    expect(extractTimes('DD 05.00\nDD 13.00')).toHaveLength(2);
  });
});

describe('buildSchedules', () => {
  it('builds an absolute UTC window from the bulletin date', () => {
    const { schedules } = buildSchedules('DD 08.00', 'DD 11.00', DATE);
    expect(schedules[0].fromUTC).toBe('2026-06-17T08:00:00.000Z');
    expect(schedules[0].toUTC).toBe('2026-06-17T11:00:00.000Z');
  });

  it('rolls the end to the next day when it crosses midnight', () => {
    const { schedules } = buildSchedules('DD 23.00', 'DD 05.00', DATE);
    expect(schedules[0].fromUTC).toBe('2026-06-17T23:00:00.000Z');
    expect(schedules[0].toUTC).toBe('2026-06-18T05:00:00.000Z');
  });

  it('pairs multiple intervals by index', () => {
    const { schedules } = buildSchedules('DD 05.00\nDD 13.00', 'DD 09.00\nDD 18.00', DATE);
    expect(schedules).toHaveLength(2);
    expect(schedules[1].fromUTC).toBe('2026-06-17T13:00:00.000Z');
    expect(schedules[1].toUTC).toBe('2026-06-17T18:00:00.000Z');
  });

  it('warns on interval count mismatch', () => {
    const { warnings } = buildSchedules('DD 05.00\nDD 13.00', 'DD 09.00', DATE);
    expect(warnings.join(' ')).toMatch(/mismatch/);
  });
});
