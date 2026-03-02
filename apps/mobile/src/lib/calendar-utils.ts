import type { Availability } from '../services/availability';

export function suggestBestTime(
  availabilities: Availability[],
): { time: string; slot: string } | null {
  if (availabilities.length === 0) return null;

  const votes = { morning: 0, afternoon: 0, night: 0 };

  for (const a of availabilities) {
    if (a.type === 'day') {
      votes.morning++;
      votes.afternoon++;
      votes.night++;
    } else if (a.type === 'slots' && a.slots) {
      for (const slot of a.slots) {
        if (slot === 'Mañana') votes.morning++;
        else if (slot === 'Tarde') votes.afternoon++;
        else if (slot === 'Noche') votes.night++;
      }
    } else if (a.type === 'range' && a.startTime && a.endTime) {
      const start = parseInt(a.startTime.split(':')[0]);
      const end = parseInt(a.endTime.split(':')[0]);
      if (start <= 13 && end >= 8) votes.morning++;
      if (start <= 19 && end >= 14) votes.afternoon++;
      if (end >= 20 || start >= 20) votes.night++;
    }
  }

  const entries = Object.entries(votes).sort(([, a], [, b]) => b - a);
  if (entries[0][1] === 0) return null;

  switch (entries[0][0]) {
    case 'morning':
      return { time: '10:00', slot: 'morning' };
    case 'afternoon':
      return { time: '17:00', slot: 'afternoon' };
    case 'night':
      return { time: '21:00', slot: 'night' };
    default:
      return null;
  }
}

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
