import { describe, it, expect } from 'vitest';
import {
  validateTimeSlots,
  sanitizeTimeSlots,
  getSlotHours,
  DEFAULT_TIME_SLOTS,
  type TimeSlotPreferences,
} from './time-slot-utils';

describe('validateTimeSlots', () => {
  it('returns null for default time slots', () => {
    expect(validateTimeSlots(DEFAULT_TIME_SLOTS)).toBeNull();
  });

  it('returns null for valid custom slots with gaps', () => {
    const slots: TimeSlotPreferences = {
      morningStart: '07:00',
      morningEnd: '12:00',
      afternoonStart: '13:00',
      afternoonEnd: '18:00',
      nightStart: '19:00',
      nightEnd: '23:30',
    };
    expect(validateTimeSlots(slots)).toBeNull();
  });

  it('returns null for contiguous slots', () => {
    const slots: TimeSlotPreferences = {
      morningStart: '06:00',
      morningEnd: '12:00',
      afternoonStart: '12:00',
      afternoonEnd: '18:00',
      nightStart: '18:00',
      nightEnd: '00:00',
    };
    expect(validateTimeSlots(slots)).toBeNull();
  });

  it('returns morning_invalid when morning start >= end', () => {
    const slots = { ...DEFAULT_TIME_SLOTS, morningStart: '14:00', morningEnd: '08:00' };
    expect(validateTimeSlots(slots)).toBe('morning_invalid');
  });

  it('returns morning_invalid when morning start equals end', () => {
    const slots = { ...DEFAULT_TIME_SLOTS, morningStart: '10:00', morningEnd: '10:00' };
    expect(validateTimeSlots(slots)).toBe('morning_invalid');
  });

  it('returns afternoon_invalid when afternoon start >= end', () => {
    const slots = { ...DEFAULT_TIME_SLOTS, afternoonStart: '20:00', afternoonEnd: '14:00' };
    expect(validateTimeSlots(slots)).toBe('afternoon_invalid');
  });

  it('returns night_invalid when night start >= end (non-midnight)', () => {
    const slots = { ...DEFAULT_TIME_SLOTS, nightStart: '23:00', nightEnd: '20:00' };
    expect(validateTimeSlots(slots)).toBe('night_invalid');
  });

  it('treats 00:00 as midnight (24:00) for night end', () => {
    const slots = { ...DEFAULT_TIME_SLOTS, nightStart: '22:00', nightEnd: '00:00' };
    expect(validateTimeSlots(slots)).toBeNull();
  });

  it('returns morning_overlaps_afternoon when morning end > afternoon start', () => {
    const slots = {
      ...DEFAULT_TIME_SLOTS,
      morningEnd: '16:00',
      afternoonStart: '14:00',
    };
    expect(validateTimeSlots(slots)).toBe('morning_overlaps_afternoon');
  });

  it('returns afternoon_overlaps_night when afternoon end > night start', () => {
    const slots = {
      ...DEFAULT_TIME_SLOTS,
      afternoonEnd: '21:00',
      nightStart: '20:00',
    };
    expect(validateTimeSlots(slots)).toBe('afternoon_overlaps_night');
  });

  it('allows morning end equal to afternoon start (contiguous)', () => {
    const slots = { ...DEFAULT_TIME_SLOTS, morningEnd: '14:00', afternoonStart: '14:00' };
    expect(validateTimeSlots(slots)).toBeNull();
  });

  it('allows afternoon end equal to night start (contiguous)', () => {
    const slots = { ...DEFAULT_TIME_SLOTS, afternoonEnd: '20:00', nightStart: '20:00' };
    expect(validateTimeSlots(slots)).toBeNull();
  });

  it('returns format_invalid for non-HH:mm strings', () => {
    const slots = { ...DEFAULT_TIME_SLOTS, morningStart: 'abc' };
    expect(validateTimeSlots(slots)).toBe('format_invalid');
  });

  it('returns format_invalid for out-of-range hours', () => {
    const slots = { ...DEFAULT_TIME_SLOTS, morningStart: '25:00' };
    expect(validateTimeSlots(slots)).toBe('format_invalid');
  });

  it('returns format_invalid for out-of-range minutes', () => {
    const slots = { ...DEFAULT_TIME_SLOTS, morningEnd: '08:61' };
    expect(validateTimeSlots(slots)).toBe('format_invalid');
  });

  it('returns format_invalid for empty string', () => {
    const slots = { ...DEFAULT_TIME_SLOTS, nightEnd: '' };
    expect(validateTimeSlots(slots)).toBe('format_invalid');
  });
});

describe('getSlotHours', () => {
  it('returns morning hours formatted', () => {
    expect(getSlotHours('morning', DEFAULT_TIME_SLOTS)).toBe('08:00 \u2013 14:00');
  });

  it('returns afternoon hours formatted', () => {
    expect(getSlotHours('afternoon', DEFAULT_TIME_SLOTS)).toBe('14:00 \u2013 20:00');
  });

  it('returns night hours formatted', () => {
    expect(getSlotHours('night', DEFAULT_TIME_SLOTS)).toBe('20:00 \u2013 00:00');
  });

  it('uses custom preferences', () => {
    const custom: TimeSlotPreferences = {
      morningStart: '06:30',
      morningEnd: '11:00',
      afternoonStart: '12:00',
      afternoonEnd: '19:00',
      nightStart: '21:00',
      nightEnd: '23:30',
    };
    expect(getSlotHours('morning', custom)).toBe('06:30 \u2013 11:00');
    expect(getSlotHours('afternoon', custom)).toBe('12:00 \u2013 19:00');
    expect(getSlotHours('night', custom)).toBe('21:00 \u2013 23:30');
  });
});

describe('sanitizeTimeSlots', () => {
  it('returns valid TimeSlotPreferences when all fields are correct', () => {
    const raw = { ...DEFAULT_TIME_SLOTS };
    expect(sanitizeTimeSlots(raw)).toEqual(DEFAULT_TIME_SLOTS);
  });

  it('returns undefined for null', () => {
    expect(sanitizeTimeSlots(null)).toBeUndefined();
  });

  it('returns undefined for undefined', () => {
    expect(sanitizeTimeSlots(undefined)).toBeUndefined();
  });

  it('returns undefined for non-object', () => {
    expect(sanitizeTimeSlots('string')).toBeUndefined();
  });

  it('returns undefined for partial object (missing fields)', () => {
    expect(sanitizeTimeSlots({ morningStart: '08:00' })).toBeUndefined();
  });

  it('returns undefined when a field has wrong format', () => {
    expect(sanitizeTimeSlots({ ...DEFAULT_TIME_SLOTS, morningStart: 'abc' })).toBeUndefined();
  });

  it('returns undefined when a field is not a string', () => {
    expect(sanitizeTimeSlots({ ...DEFAULT_TIME_SLOTS, morningStart: 123 })).toBeUndefined();
  });
});

describe('DEFAULT_TIME_SLOTS', () => {
  it('has correct default values', () => {
    expect(DEFAULT_TIME_SLOTS.morningStart).toBe('08:00');
    expect(DEFAULT_TIME_SLOTS.morningEnd).toBe('14:00');
    expect(DEFAULT_TIME_SLOTS.afternoonStart).toBe('14:00');
    expect(DEFAULT_TIME_SLOTS.afternoonEnd).toBe('20:00');
    expect(DEFAULT_TIME_SLOTS.nightStart).toBe('20:00');
    expect(DEFAULT_TIME_SLOTS.nightEnd).toBe('00:00');
  });
});
