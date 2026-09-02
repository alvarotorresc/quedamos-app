import { BadRequestException } from '@nestjs/common';
import { ParseCalendarDatePipe } from './parse-calendar-date.pipe';

describe('ParseCalendarDatePipe', () => {
  const pipe = new ParseCalendarDatePipe();

  it('should return real calendar days untouched', () => {
    for (const date of ['2026-03-01', '2024-02-29', '2026-12-31']) {
      expect(pipe.transform(date)).toBe(date);
    }
  });

  it('should reject malformed dates', () => {
    for (const date of ['15-03-2026', '2026-3-5', '2026-03-01T00:00:00Z', '', 'yesterday']) {
      expect(() => pipe.transform(date)).toThrow(BadRequestException);
    }
  });

  it('should reject impossible calendar days', () => {
    for (const date of ['2026-02-30', '2026-13-01', '2026-00-10', '2026-06-31', '2026-02-29']) {
      expect(() => pipe.transform(date)).toThrow(BadRequestException);
    }
  });
});
