import type { Availability } from '../services/availability';

const SLOT_KEYS: Record<string, string> = {
  Mañana: 'calendar.availability.morning',
  Tarde: 'calendar.availability.afternoon',
  Noche: 'calendar.availability.night',
};

export function availabilityLabel(avail: Availability, t: (k: string) => string): string {
  if (avail.type === 'day') return t('calendar.allDay');
  if (avail.type === 'slots') {
    return (avail.slots ?? []).map((s) => t(SLOT_KEYS[s] ?? s)).join(' · ');
  }
  return `${avail.startTime ?? ''} – ${avail.endTime ?? ''}`;
}
