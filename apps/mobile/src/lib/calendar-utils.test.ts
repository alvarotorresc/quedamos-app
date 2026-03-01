import { describe, it, expect } from 'vitest';
import { calculateTopDays } from './calendar-utils';
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

function buildMap(
  entries: Array<[string, number]>,
): Map<string, Availability[]> {
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
