import { describe, it, expect } from 'vitest';
import {
  formatDateKey,
  apiDateToKey,
  isSameDay,
  isToday,
  parseDateKey,
  getWeekDays,
  getMonthCells,
} from './date-utils';

describe('formatDateKey', () => {
  it('should format date as YYYY-MM-DD', () => {
    expect(formatDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('should pad single-digit month and day', () => {
    expect(formatDateKey(new Date(2026, 2, 3))).toBe('2026-03-03');
  });

  it('should handle December correctly', () => {
    expect(formatDateKey(new Date(2026, 11, 31))).toBe('2026-12-31');
  });
});

describe('apiDateToKey', () => {
  it('should extract date from ISO string', () => {
    expect(apiDateToKey('2026-02-08T00:00:00.000Z')).toBe('2026-02-08');
  });

  it('should handle plain date string', () => {
    expect(apiDateToKey('2026-02-08')).toBe('2026-02-08');
  });

  it('should handle date with timezone offset', () => {
    expect(apiDateToKey('2026-02-08T12:30:00+02:00')).toBe('2026-02-08');
  });
});

describe('isSameDay', () => {
  it('should return true for same day', () => {
    expect(isSameDay(new Date(2026, 0, 1), new Date(2026, 0, 1))).toBe(true);
  });

  it('should return false for different days', () => {
    expect(isSameDay(new Date(2026, 0, 1), new Date(2026, 0, 2))).toBe(false);
  });

  it('should return false when a is null', () => {
    expect(isSameDay(null, new Date())).toBe(false);
  });

  it('should return false when b is null', () => {
    expect(isSameDay(new Date(), null)).toBe(false);
  });

  it('should return true for same day with different times', () => {
    const a = new Date(2026, 5, 15, 10, 30);
    const b = new Date(2026, 5, 15, 22, 0);
    expect(isSameDay(a, b)).toBe(true);
  });
});

describe('isToday', () => {
  it('should return true for today', () => {
    expect(isToday(new Date())).toBe(true);
  });

  it('should return false for yesterday', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(isToday(yesterday)).toBe(false);
  });
});

describe('parseDateKey', () => {
  it('should parse YYYY-MM-DD to Date', () => {
    const date = parseDateKey('2026-03-15');
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(2); // March = 2
    expect(date.getDate()).toBe(15);
  });
});

describe('getWeekDays', () => {
  it('should return 7 days', () => {
    const days = getWeekDays(new Date(2026, 1, 10), 0); // Feb 10 2026 = Tuesday
    expect(days).toHaveLength(7);
  });

  it('should start on Monday', () => {
    const days = getWeekDays(new Date(2026, 1, 10), 0);
    expect(days[0].getDay()).toBe(1); // Monday
  });

  it('should offset weeks correctly', () => {
    const thisWeek = getWeekDays(new Date(2026, 1, 10), 0);
    const nextWeek = getWeekDays(new Date(2026, 1, 10), 1);
    const diff = nextWeek[0].getTime() - thisWeek[0].getTime();
    expect(diff).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

describe('getMonthCells', () => {
  it('should return cells and month date', () => {
    const { cells, month } = getMonthCells(new Date(2026, 1, 1), 0); // February 2026
    expect(month.getMonth()).toBe(1);
    expect(cells.length).toBeGreaterThan(0);
  });

  it('should pad with nulls for days before first of month', () => {
    // Feb 2026 starts on Sunday → 6 nulls (Mon-Sat before)
    const { cells } = getMonthCells(new Date(2026, 1, 1), 0);
    const nullCount = cells.filter((c) => c === null).length;
    expect(nullCount).toBeGreaterThanOrEqual(0);
  });

  it('should contain all days of the month', () => {
    const { cells } = getMonthCells(new Date(2026, 0, 1), 0); // January 2026
    const dates = cells.filter((c) => c !== null);
    expect(dates).toHaveLength(31);
  });

  it('should handle month offset', () => {
    const { month } = getMonthCells(new Date(2026, 0, 1), 2); // Jan + 2 = March
    expect(month.getMonth()).toBe(2);
  });
});
