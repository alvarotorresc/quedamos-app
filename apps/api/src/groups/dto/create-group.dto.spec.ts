import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateGroupDto } from './create-group.dto';

describe('CreateGroupDto', () => {
  function createDto(partial: Partial<Record<string, unknown>>): CreateGroupDto {
    return plainToInstance(CreateGroupDto, partial);
  }

  it('should accept valid payload with name and emoji', async () => {
    const dto = createDto({ name: 'Test Group', emoji: '🎉' });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should accept valid payload without optional emoji', async () => {
    const dto = createDto({ name: 'Test Group' });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should reject missing name', async () => {
    const dto = createDto({ emoji: '🎉' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('name');
  });

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
    const dto = createDto({ name: 123 });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const nameError = errors.find((e) => e.property === 'name');
    expect(nameError).toBeDefined();
  });

  it('should reject emoji longer than 10 characters', async () => {
    const dto = createDto({ name: 'Group', emoji: 'a'.repeat(11) });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const emojiError = errors.find((e) => e.property === 'emoji');
    expect(emojiError).toBeDefined();
    expect(emojiError!.constraints).toHaveProperty('maxLength');
  });

  it('should accept emoji exactly 10 characters', async () => {
    const dto = createDto({ name: 'Group', emoji: 'a'.repeat(10) });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should reject non-string emoji', async () => {
    const dto = createDto({ name: 'Group', emoji: 42 });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const emojiError = errors.find((e) => e.property === 'emoji');
    expect(emojiError).toBeDefined();
  });
});
