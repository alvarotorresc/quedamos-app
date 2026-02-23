import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateProfileDto } from './update-profile.dto';

describe('UpdateProfileDto', () => {
  function createDto(
    partial: Partial<Record<string, unknown>>,
  ): UpdateProfileDto {
    return plainToInstance(UpdateProfileDto, partial);
  }

  describe('valid payloads', () => {
    it('should accept valid name and avatarEmoji', async () => {
      const dto = createDto({ name: 'Alvaro', avatarEmoji: '😎' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept name only', async () => {
      const dto = createDto({ name: 'Alvaro' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept avatarEmoji only', async () => {
      const dto = createDto({ avatarEmoji: '🎸' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept empty object (all fields optional)', async () => {
      const dto = createDto({});
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('name validation', () => {
    it('should reject name longer than 100 characters', async () => {
      const dto = createDto({ name: 'a'.repeat(101) });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const nameError = errors.find((e) => e.property === 'name');
      expect(nameError).toBeDefined();
      expect(nameError!.constraints).toHaveProperty('maxLength');
    });

    it('should accept name exactly 100 characters', async () => {
      const dto = createDto({ name: 'a'.repeat(100) });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should reject non-string name', async () => {
      const dto = createDto({ name: 42 });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const nameError = errors.find((e) => e.property === 'name');
      expect(nameError).toBeDefined();
    });
  });

  describe('avatarEmoji validation', () => {
    it('should reject avatarEmoji longer than 10 characters', async () => {
      const dto = createDto({ avatarEmoji: 'a'.repeat(11) });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const emojiError = errors.find((e) => e.property === 'avatarEmoji');
      expect(emojiError).toBeDefined();
      expect(emojiError!.constraints).toHaveProperty('maxLength');
    });

    it('should accept avatarEmoji exactly 10 characters', async () => {
      const dto = createDto({ avatarEmoji: 'a'.repeat(10) });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should reject non-string avatarEmoji', async () => {
      const dto = createDto({ avatarEmoji: 123 });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const emojiError = errors.find((e) => e.property === 'avatarEmoji');
      expect(emojiError).toBeDefined();
    });
  });
});
