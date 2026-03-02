import { describe, it, expect } from 'vitest';
import { calculateTopDays, suggestBestTime } from './calendar-utils';
import type { Availability } from '../services/availability';

function makeAvailability(overrides: Partial<Availability> = {}): Availability {
  return {
    id: crypto.randomUUID(),
    userId: crypto.randomUUID(),
    groupId: 'group-1',
    date: '2026-03-10',
    type: 'day',
    ...overrides,
  };
}

function buildMap(entries: Array<[string, number]>): Map<string, Availability[]> {
  const map = new Map<string, Availability[]>();
  for (const [dateKey, count] of entries) {
    const avails: Availability[] = [];
    for (let i = 0; i < count; i++) {
      avails.push(makeAvailability({ date: dateKey, userId: `user-${i}` }));
    }
    map.set(dateKey, avails);
  }
  return map;
}

function makeAvail(overrides: Partial<Availability> = {}): Availability {
  return {
    id: crypto.randomUUID(),
    userId: 'u1',
    groupId: 'g1',
    date: '2026-03-10',
    type: 'day',
    ...overrides,
  };
}

describe('suggestBestTime', () => {
  it('should return null for empty array', () => {
    expect(suggestBestTime([])).toBeNull();
  });

  it('should return null when all vote counts are zero', () => {
    // range that overlaps nothing
    const a = makeAvail({ type: 'range', startTime: '00:00', endTime: '00:00' });
    expect(suggestBestTime([a])).toBeNull();
  });

  it('should count all slots for type "day"', () => {
    const avails = [makeAvail({ type: 'day' }), makeAvail({ type: 'day' })];
    // all slots tied → Object.entries preserves insertion order: morning wins
    const result = suggestBestTime(avails);
    expect(result).not.toBeNull();
  });

  it('should return afternoon when majority votes Tarde', () => {
    const avails = [
      makeAvail({ type: 'slots', slots: ['Tarde'] }),
      makeAvail({ type: 'slots', slots: ['Tarde'] }),
      makeAvail({ type: 'slots', slots: ['Mañana'] }),
    ];
    expect(suggestBestTime(avails)).toEqual({ time: '17:00', slot: 'afternoon' });
  });

  it('should return morning when majority votes Mañana', () => {
    const avails = [
      makeAvail({ type: 'slots', slots: ['Mañana'] }),
      makeAvail({ type: 'slots', slots: ['Mañana'] }),
      makeAvail({ type: 'slots', slots: ['Noche'] }),
    ];
    expect(suggestBestTime(avails)).toEqual({ time: '10:00', slot: 'morning' });
  });

  it('should return night when majority votes Noche', () => {
    const avails = [
      makeAvail({ type: 'slots', slots: ['Noche', 'Noche'] }),
      makeAvail({ type: 'slots', slots: ['Tarde'] }),
    ];
    expect(suggestBestTime(avails)).toEqual({ time: '21:00', slot: 'night' });
  });

  it('should count range overlapping morning (08:00–13:00)', () => {
    const a = makeAvail({ type: 'range', startTime: '09:00', endTime: '12:00' });
    expect(suggestBestTime([a])).toEqual({ time: '10:00', slot: 'morning' });
  });

  it('should count range overlapping afternoon (14:00–19:00)', () => {
    const a = makeAvail({ type: 'range', startTime: '15:00', endTime: '18:00' });
    expect(suggestBestTime([a])).toEqual({ time: '17:00', slot: 'afternoon' });
  });

  it('should count range overlapping night (start >= 20)', () => {
    const a = makeAvail({ type: 'range', startTime: '21:00', endTime: '23:00' });
    expect(suggestBestTime([a])).toEqual({ time: '21:00', slot: 'night' });
  });

  it('should ignore slots entries with null/undefined slots array', () => {
    const a = makeAvail({ type: 'slots', slots: undefined });
    expect(suggestBestTime([a])).toBeNull();
  });
});

describe('calculateTopDays', () => {
  const today = '2026-03-01';

  it('should return top 2 days by availability count', () => {
    const map = buildMap([
      ['2026-03-05', 3],
      ['2026-03-07', 5],
      ['2026-03-10', 4],
    ]);

    const result = calculateTopDays(map, today, 2);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ dateKey: '2026-03-07', count: 5, rank: 1 });
    expect(result[1]).toEqual({ dateKey: '2026-03-10', count: 4, rank: 2 });
  });

  it('should handle tie by returning first chronologically', () => {
    const map = buildMap([
      ['2026-03-12', 3],
      ['2026-03-05', 3],
      ['2026-03-08', 3],
    ]);

    const result = calculateTopDays(map, today, 2);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ dateKey: '2026-03-05', count: 3, rank: 1 });
    expect(result[1]).toEqual({ dateKey: '2026-03-08', count: 3, rank: 2 });
  });

  it('should exclude past days', () => {
    const map = buildMap([
      ['2026-02-20', 5],
      ['2026-02-28', 4],
      ['2026-03-05', 2],
    ]);

    const result = calculateTopDays(map, today, 2);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ dateKey: '2026-03-05', count: 2, rank: 1 });
  });

  it('should return empty array for no availability', () => {
    const map = new Map<string, Availability[]>();

    const result = calculateTopDays(map, today, 2);

    expect(result).toEqual([]);
  });

  it('should return 1 item if only 1 day has availability', () => {
    const map = buildMap([['2026-03-15', 3]]);

    const result = calculateTopDays(map, today, 2);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ dateKey: '2026-03-15', count: 3, rank: 1 });
  });
});
