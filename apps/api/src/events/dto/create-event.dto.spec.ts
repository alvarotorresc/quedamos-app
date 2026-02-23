import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateEventDto } from './create-event.dto';

describe('CreateEventDto', () => {
  function createDto(partial: Partial<Record<string, unknown>>): CreateEventDto {
    return plainToInstance(CreateEventDto, partial);
  }

  const validPayload = { title: 'Friday Dinner', date: '2026-03-20' };

  describe('valid payloads', () => {
    it('should accept valid payload with required fields only', async () => {
      const dto = createDto(validPayload);
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept valid payload with all optional fields', async () => {
      const dto = createDto({
        ...validPayload,
        description: 'Dinner at the usual place',
        location: 'Restaurant XYZ',
        time: '20:30',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('title validation', () => {
    it('should reject missing title', async () => {
      const dto = createDto({ date: '2026-03-20' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const titleError = errors.find((e) => e.property === 'title');
      expect(titleError).toBeDefined();
    });

    it('should reject title longer than 200 characters', async () => {
      const dto = createDto({ title: 'a'.repeat(201), date: '2026-03-20' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const titleError = errors.find((e) => e.property === 'title');
      expect(titleError).toBeDefined();
      expect(titleError!.constraints).toHaveProperty('maxLength');
    });

    it('should accept title exactly 200 characters', async () => {
      const dto = createDto({ title: 'a'.repeat(200), date: '2026-03-20' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should reject non-string title', async () => {
      const dto = createDto({ title: 999, date: '2026-03-20' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('date validation', () => {
    it('should reject missing date', async () => {
      const dto = createDto({ title: 'Dinner' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const dateError = errors.find((e) => e.property === 'date');
      expect(dateError).toBeDefined();
    });

    it('should reject invalid date format', async () => {
      const dto = createDto({ title: 'Dinner', date: '20/03/2026' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const dateError = errors.find((e) => e.property === 'date');
      expect(dateError).toBeDefined();
      expect(dateError!.constraints).toHaveProperty('matches');
    });

    it('should accept valid YYYY-MM-DD format', async () => {
      const dto = createDto({ title: 'Dinner', date: '2026-01-01' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('optional fields', () => {
    it('should reject description longer than 1000 characters', async () => {
      const dto = createDto({
        ...validPayload,
        description: 'x'.repeat(1001),
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const descError = errors.find((e) => e.property === 'description');
      expect(descError).toBeDefined();
      expect(descError!.constraints).toHaveProperty('maxLength');
    });

    it('should accept description exactly 1000 characters', async () => {
      const dto = createDto({
        ...validPayload,
        description: 'x'.repeat(1000),
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should reject location longer than 200 characters', async () => {
      const dto = createDto({
        ...validPayload,
        location: 'y'.repeat(201),
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const locError = errors.find((e) => e.property === 'location');
      expect(locError).toBeDefined();
      expect(locError!.constraints).toHaveProperty('maxLength');
    });

    it('should accept location exactly 200 characters', async () => {
      const dto = createDto({
        ...validPayload,
        location: 'y'.repeat(200),
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should reject invalid time format', async () => {
      const dto = createDto({ ...validPayload, time: '8:30 PM' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const timeError = errors.find((e) => e.property === 'time');
      expect(timeError).toBeDefined();
      expect(timeError!.constraints).toHaveProperty('matches');
    });

    it('should accept valid HH:mm time format', async () => {
      const dto = createDto({ ...validPayload, time: '20:30' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should reject non-string description', async () => {
      const dto = createDto({ ...validPayload, description: 42 });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject non-string location', async () => {
      const dto = createDto({ ...validPayload, location: true });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
