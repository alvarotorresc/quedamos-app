import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateAvailabilityDto } from './create-availability.dto';

describe('CreateAvailabilityDto', () => {
  function createDto(
    partial: Partial<Record<string, unknown>>,
  ): CreateAvailabilityDto {
    return plainToInstance(CreateAvailabilityDto, partial);
  }

  describe('valid payloads', () => {
    it('should accept type "day" with date only', async () => {
      const dto = createDto({ date: '2026-03-15', type: 'day' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept type "slots" with slots array', async () => {
      const dto = createDto({
        date: '2026-03-15',
        type: 'slots',
        slots: ['Mañana', 'Tarde'],
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept type "range" with startTime and endTime', async () => {
      const dto = createDto({
        date: '2026-03-15',
        type: 'range',
        startTime: '09:00',
        endTime: '17:30',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('date validation', () => {
    it('should reject missing date', async () => {
      const dto = createDto({ type: 'day' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const dateError = errors.find((e) => e.property === 'date');
      expect(dateError).toBeDefined();
    });

    it('should reject invalid date format', async () => {
      const dto = createDto({ date: '15-03-2026', type: 'day' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const dateError = errors.find((e) => e.property === 'date');
      expect(dateError).toBeDefined();
      expect(dateError!.constraints).toHaveProperty('matches');
    });

    it('should reject date without leading zeros', async () => {
      const dto = createDto({ date: '2026-3-5', type: 'day' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject non-string date', async () => {
      const dto = createDto({ date: 20260315, type: 'day' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('type validation', () => {
    it('should reject missing type', async () => {
      const dto = createDto({ date: '2026-03-15' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const typeError = errors.find((e) => e.property === 'type');
      expect(typeError).toBeDefined();
    });

    it('should reject invalid type value', async () => {
      const dto = createDto({ date: '2026-03-15', type: 'invalid' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const typeError = errors.find((e) => e.property === 'type');
      expect(typeError).toBeDefined();
      expect(typeError!.constraints).toHaveProperty('isIn');
    });

    it.each(['day', 'slots', 'range'])(
      'should accept type "%s"',
      async (type) => {
        const dto = createDto({ date: '2026-03-15', type });
        const errors = await validate(dto);
        const typeErrors = errors.filter((e) => e.property === 'type');
        expect(typeErrors.length).toBe(0);
      },
    );
  });

  describe('slots validation', () => {
    it('should accept empty slots as optional', async () => {
      const dto = createDto({ date: '2026-03-15', type: 'day' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should reject non-array slots', async () => {
      const dto = createDto({
        date: '2026-03-15',
        type: 'slots',
        slots: 'Mañana',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject slots with non-string elements', async () => {
      const dto = createDto({
        date: '2026-03-15',
        type: 'slots',
        slots: [123, 456],
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('time validation', () => {
    it('should reject invalid startTime format', async () => {
      const dto = createDto({
        date: '2026-03-15',
        type: 'range',
        startTime: '9:00',
        endTime: '17:00',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const startError = errors.find((e) => e.property === 'startTime');
      expect(startError).toBeDefined();
    });

    it('should reject invalid endTime format', async () => {
      const dto = createDto({
        date: '2026-03-15',
        type: 'range',
        startTime: '09:00',
        endTime: '5pm',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const endError = errors.find((e) => e.property === 'endTime');
      expect(endError).toBeDefined();
    });

    it('should accept valid HH:mm time format', async () => {
      const dto = createDto({
        date: '2026-03-15',
        type: 'range',
        startTime: '00:00',
        endTime: '23:59',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });
});
