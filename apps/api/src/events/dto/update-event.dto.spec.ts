import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateEventDto } from './update-event.dto';

describe('UpdateEventDto', () => {
  function createDto(partial: Partial<Record<string, unknown>>): UpdateEventDto {
    return plainToInstance(UpdateEventDto, partial);
  }

  describe('coordinate range validation', () => {
    it('should accept valid coordinates', async () => {
      const dto = createDto({ locationLat: 40.4153, locationLon: -3.6845 });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept boundary latitude values', async () => {
      for (const lat of [-90, 90]) {
        const dto = createDto({ locationLat: lat, locationLon: 0 });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
      }
    });

    it('should accept boundary longitude values', async () => {
      for (const lon of [-180, 180]) {
        const dto = createDto({ locationLat: 0, locationLon: lon });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
      }
    });

    it('should reject latitude below -90', async () => {
      const dto = createDto({ locationLat: -91 });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const latError = errors.find((e) => e.property === 'locationLat');
      expect(latError).toBeDefined();
      expect(latError!.constraints).toHaveProperty('min');
    });

    it('should reject latitude above 90', async () => {
      const dto = createDto({ locationLat: 91 });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const latError = errors.find((e) => e.property === 'locationLat');
      expect(latError).toBeDefined();
      expect(latError!.constraints).toHaveProperty('max');
    });

    it('should reject longitude below -180', async () => {
      const dto = createDto({ locationLon: -181 });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const lonError = errors.find((e) => e.property === 'locationLon');
      expect(lonError).toBeDefined();
      expect(lonError!.constraints).toHaveProperty('min');
    });

    it('should reject longitude above 180', async () => {
      const dto = createDto({ locationLon: 181 });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const lonError = errors.find((e) => e.property === 'locationLon');
      expect(lonError).toBeDefined();
      expect(lonError!.constraints).toHaveProperty('max');
    });
  });
});
