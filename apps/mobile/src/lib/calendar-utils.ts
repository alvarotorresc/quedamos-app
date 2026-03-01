import type { Availability } from '../services/availability';

export function calculateTopDays(
  availabilityByDate: Map<string, Availability[]>,
  today: string,
  count: number = 2,
): Array<{ dateKey: string; count: number; rank: number }> {
  const entries: Array<{ dateKey: string; count: number }> = [];

  availabilityByDate.forEach((avails, dateKey) => {
    if (dateKey >= today) {
      entries.push({ dateKey, count: avails.length });
    }
  });

  // Sort by count descending, then by date ascending for ties
  entries.sort((a, b) => b.count - a.count || a.dateKey.localeCompare(b.dateKey));

  return entries.slice(0, count).map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }));
}
