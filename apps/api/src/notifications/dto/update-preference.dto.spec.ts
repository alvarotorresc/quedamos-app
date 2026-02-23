import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdatePreferenceDto } from './update-preference.dto';

describe('UpdatePreferenceDto', () => {
  function createDto(
    partial: Partial<Record<string, unknown>>,
  ): UpdatePreferenceDto {
    return plainToInstance(UpdatePreferenceDto, partial);
  }

  const validTypes = [
    'new_event',
    'event_confirmed',
    'event_declined',
    'member_joined',
    'member_left',
  ] as const;

  describe('valid payloads', () => {
    it.each(validTypes)(
      'should accept valid type "%s" with enabled true',
      async (type) => {
        const dto = createDto({ type, enabled: true });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
      },
    );

    it.each(validTypes)(
      'should accept valid type "%s" with enabled false',
      async (type) => {
        const dto = createDto({ type, enabled: false });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
      },
    );
  });

  describe('type validation', () => {
    it('should reject missing type', async () => {
      const dto = createDto({ enabled: true });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const typeError = errors.find((e) => e.property === 'type');
      expect(typeError).toBeDefined();
    });

    it('should reject invalid type value', async () => {
      const dto = createDto({ type: 'push_all', enabled: true });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const typeError = errors.find((e) => e.property === 'type');
      expect(typeError).toBeDefined();
      expect(typeError!.constraints).toHaveProperty('isIn');
    });

    it('should reject non-string type', async () => {
      const dto = createDto({ type: 42, enabled: true });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('enabled validation', () => {
    it('should reject missing enabled', async () => {
      const dto = createDto({ type: 'new_event' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const enabledError = errors.find((e) => e.property === 'enabled');
      expect(enabledError).toBeDefined();
    });

    it('should reject non-boolean enabled (string "true")', async () => {
      const dto = createDto({ type: 'new_event', enabled: 'true' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const enabledError = errors.find((e) => e.property === 'enabled');
      expect(enabledError).toBeDefined();
      expect(enabledError!.constraints).toHaveProperty('isBoolean');
    });

    it('should reject non-boolean enabled (number 1)', async () => {
      const dto = createDto({ type: 'new_event', enabled: 1 });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const enabledError = errors.find((e) => e.property === 'enabled');
      expect(enabledError).toBeDefined();
    });
  });

  it('should reject empty object', async () => {
    const dto = createDto({});
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });
});
