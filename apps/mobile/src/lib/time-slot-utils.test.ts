import { describe, it, expect } from 'vitest';
import * as shared from '@quedamos/shared';
import {
  DEFAULT_TIME_SLOTS,
  getSlotHours,
  sanitizeTimeSlots,
  validateTimeSlots,
} from './time-slot-utils';

// La implementación y su batería de casos viven en packages/shared
// (`src/time-slots.test.ts`); aquí solo se comprueba que la app sigue mirando
// a ese módulo y no a una copia suya.
describe('time-slot-utils', () => {
  it('re-exports the shared implementation', () => {
    expect(DEFAULT_TIME_SLOTS).toBe(shared.DEFAULT_TIME_SLOTS);
    expect(sanitizeTimeSlots).toBe(shared.sanitizeTimeSlots);
    expect(validateTimeSlots).toBe(shared.validateTimeSlots);
    expect(getSlotHours).toBe(shared.getSlotHours);
  });

  it('keeps the shape stored in user_metadata since v1.0.0', () => {
    expect(DEFAULT_TIME_SLOTS).toEqual({
      morningStart: '08:00',
      morningEnd: '14:00',
      afternoonStart: '14:00',
      afternoonEnd: '20:00',
      nightStart: '20:00',
      nightEnd: '00:00',
    });
    expect(sanitizeTimeSlots(DEFAULT_TIME_SLOTS)).toEqual(DEFAULT_TIME_SLOTS);
    expect(sanitizeTimeSlots({ morningStart: '08:00' })).toBeUndefined();
  });
});
