import { describe, it, expect } from 'vitest';
import { availabilityLabel } from './availability-label';

const t = (k: string) => k;

describe('availabilityLabel', () => {
  it('día completo', () => {
    expect(availabilityLabel({ type: 'day' } as never, t)).toBe('calendar.allDay');
  });
  it('franjas traducidas, no literales persistidos', () => {
    expect(availabilityLabel({ type: 'slots', slots: ['Mañana', 'Noche'] } as never, t))
      .toBe('calendar.availability.morning · calendar.availability.night');
  });
  it('rango', () => {
    expect(availabilityLabel({ type: 'range', startTime: '16:00', endTime: '22:00' } as never, t))
      .toBe('16:00 – 22:00');
  });
});
