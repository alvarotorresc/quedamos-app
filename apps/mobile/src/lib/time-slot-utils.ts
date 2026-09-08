/**
 * Las franjas del usuario (su mañana, su tarde y su noche) se guardan en
 * `user_metadata` de Supabase y viajan a la API dentro del JWT, así que su forma
 * y su saneado viven en `packages/shared`: la app y la API tienen que entender
 * exactamente lo mismo. Este módulo se queda como la puerta por la que la app
 * las importa.
 */
export {
  DEFAULT_TIME_SLOTS,
  TIME_SLOT_KEYS,
  getSlotHours,
  getSlotRange,
  isTimeSlotKey,
  sanitizeTimeSlots,
  timeSlotsEqual,
  validateTimeSlots,
} from '@quedamos/shared';

export type { TimeSlotError, TimeSlotKey, TimeSlotPreferences } from '@quedamos/shared';
