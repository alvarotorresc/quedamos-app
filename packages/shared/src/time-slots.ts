/**
 * Las franjas del usuario: a qué hora empieza y acaba su mañana, su tarde y su
 * noche. Se guardan en `user_metadata.timeSlots` de Supabase (el perfil las
 * edita) y desde ahí llegan a la API en el JWT, así que este módulo es el único
 * sitio donde vive su forma: la app y la API tienen que sanear exactamente igual
 * lo que un usuario puede escribir en su propio `user_metadata`.
 *
 * La forma es plana (`morningStart`, `morningEnd`, …) porque es la que ya está
 * guardada en producción desde v1.0.0; anidarla dejaría a todo el mundo con sus
 * franjas saneadas a `undefined` y de vuelta a las de por defecto.
 */

export const TIME_SLOT_KEYS = ['morning', 'afternoon', 'night'] as const;

export type TimeSlotKey = (typeof TIME_SLOT_KEYS)[number];

/**
 * Alias de tipo y no interfaz a proposito: una interfaz no tiene index signature
 * implicita y Prisma no la acepta como valor de una columna JSON.
 */
export type TimeSlotPreferences = {
  morningStart: string;
  morningEnd: string;
  afternoonStart: string;
  afternoonEnd: string;
  nightStart: string;
  nightEnd: string;
};

export const DEFAULT_TIME_SLOTS: TimeSlotPreferences = {
  morningStart: '08:00',
  morningEnd: '14:00',
  afternoonStart: '14:00',
  afternoonEnd: '20:00',
  nightStart: '20:00',
  nightEnd: '00:00',
};

const TIME_SLOT_FIELDS: (keyof TimeSlotPreferences)[] = [
  'morningStart',
  'morningEnd',
  'afternoonStart',
  'afternoonEnd',
  'nightStart',
  'nightEnd',
];

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Compare two HH:mm strings. Treats '00:00' as '24:00' when used as
 * the night-slot end so that "20:00 – 00:00" is considered valid.
 */
function toMinutes(time: string, isNightEnd = false): number {
  const [h, m] = time.split(':').map(Number);
  const mins = h * 60 + m;
  return mins === 0 && isNightEnd ? 1440 : mins;
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
  const values = TIME_SLOT_FIELDS.map((k) => slots[k]);
  if (!values.every((v) => typeof v === 'string' && TIME_RE.test(v))) {
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

/**
 * Lo que llega de `user_metadata` lo escribe el propio usuario (el cliente puede
 * llamar a `supabase.auth.updateUser` con lo que quiera), así que se copian solo
 * los seis campos conocidos y se exige que las franjas sean coherentes entre sí:
 * lo que sobreviva a esto es lo que la API guarda y lo que la app pinta.
 */
export function sanitizeTimeSlots(raw: unknown): TimeSlotPreferences | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const r = raw as Record<string, unknown>;
  if (!TIME_SLOT_FIELDS.every((k) => typeof r[k] === 'string' && TIME_RE.test(r[k] as string))) {
    return undefined;
  }
  const slots = {
    morningStart: r.morningStart,
    morningEnd: r.morningEnd,
    afternoonStart: r.afternoonStart,
    afternoonEnd: r.afternoonEnd,
    nightStart: r.nightStart,
    nightEnd: r.nightEnd,
  } as TimeSlotPreferences;
  return validateTimeSlots(slots) === null ? slots : undefined;
}

/** Igualdad por valor, sin depender del orden de las claves del JSON guardado. */
export function timeSlotsEqual(a: unknown, b: unknown): boolean {
  const sa = sanitizeTimeSlots(a);
  const sb = sanitizeTimeSlots(b);
  if (!sa || !sb) return !sa && !sb;
  return TIME_SLOT_FIELDS.every((k) => sa[k] === sb[k]);
}

export function isTimeSlotKey(value: unknown): value is TimeSlotKey {
  return typeof value === 'string' && (TIME_SLOT_KEYS as readonly string[]).includes(value);
}

/** Las horas reales de una franja: lo que convierte «por la tarde» en «16:30». */
export function getSlotRange(
  key: TimeSlotKey,
  prefs: TimeSlotPreferences,
): { start: string; end: string } {
  switch (key) {
    case 'morning':
      return { start: prefs.morningStart, end: prefs.morningEnd };
    case 'afternoon':
      return { start: prefs.afternoonStart, end: prefs.afternoonEnd };
    case 'night':
      return { start: prefs.nightStart, end: prefs.nightEnd };
  }
}

export function getSlotHours(key: TimeSlotKey, prefs: TimeSlotPreferences): string {
  const { start, end } = getSlotRange(key, prefs);
  return `${start} – ${end}`;
}
