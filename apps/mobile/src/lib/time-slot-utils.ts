export interface TimeSlotPreferences {
  morningStart: string;
  morningEnd: string;
  afternoonStart: string;
  afternoonEnd: string;
  nightStart: string;
  nightEnd: string;
}

export const DEFAULT_TIME_SLOTS: TimeSlotPreferences = {
  morningStart: '08:00',
  morningEnd: '14:00',
  afternoonStart: '14:00',
  afternoonEnd: '20:00',
  nightStart: '20:00',
  nightEnd: '00:00',
};

/**
 * Compare two HH:mm strings. Treats '00:00' as '24:00' when used as
 * the night-slot end so that "20:00 – 00:00" is considered valid.
 */
function toMinutes(time: string, isNightEnd = false): number {
  const [h, m] = time.split(':').map(Number);
  const mins = h * 60 + m;
  return mins === 0 && isNightEnd ? 1440 : mins;
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function sanitizeTimeSlots(raw: unknown): TimeSlotPreferences | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const keys: (keyof TimeSlotPreferences)[] = [
    'morningStart',
    'morningEnd',
    'afternoonStart',
    'afternoonEnd',
    'nightStart',
    'nightEnd',
  ];
  if (!keys.every((k) => typeof r[k] === 'string' && TIME_RE.test(r[k] as string))) {
    return undefined;
  }
  return raw as TimeSlotPreferences;
}

export type TimeSlotError =
  | 'format_invalid'
  | 'morning_invalid'
  | 'afternoon_invalid'
  | 'night_invalid'
  | 'morning_overlaps_afternoon'
  | 'afternoon_overlaps_night'
  | null;

export function validateTimeSlots(slots: TimeSlotPreferences): TimeSlotError {
  const values = Object.values(slots);
  if (values.length !== 6 || !values.every((v) => typeof v === 'string' && TIME_RE.test(v))) {
    return 'format_invalid';
  }

  const ms = toMinutes(slots.morningStart);
  const me = toMinutes(slots.morningEnd);
  const as_ = toMinutes(slots.afternoonStart);
  const ae = toMinutes(slots.afternoonEnd);
  const ns = toMinutes(slots.nightStart);
  const ne = toMinutes(slots.nightEnd, true);

  if (ms >= me) return 'morning_invalid';
  if (as_ >= ae) return 'afternoon_invalid';
  if (ns >= ne) return 'night_invalid';
  if (me > as_) return 'morning_overlaps_afternoon';
  if (ae > ns) return 'afternoon_overlaps_night';

  return null;
}

export function getSlotHours(
  key: 'morning' | 'afternoon' | 'night',
  prefs: TimeSlotPreferences,
): string {
  switch (key) {
    case 'morning':
      return `${prefs.morningStart} \u2013 ${prefs.morningEnd}`;
    case 'afternoon':
      return `${prefs.afternoonStart} \u2013 ${prefs.afternoonEnd}`;
    case 'night':
      return `${prefs.nightStart} \u2013 ${prefs.nightEnd}`;
  }
}
