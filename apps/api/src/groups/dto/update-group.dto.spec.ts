import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateGroupDto } from './update-group.dto';

describe('UpdateGroupDto', () => {
  function createDto(partial: Partial<Record<string, unknown>>): UpdateGroupDto {
    return plainToInstance(UpdateGroupDto, partial);
  }

  it('should accept a payload with both name and emoji', async () => {
    const dto = createDto({ name: 'La cuadrilla', emoji: '🏔️' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('should accept a payload that only renames the group', async () => {
    const dto = createDto({ name: 'La cuadrilla' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('should accept a payload that only changes the emoji', async () => {
    const dto = createDto({ emoji: '🏔️' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('should accept an empty payload: every field is optional', async () => {
    const dto = createDto({});
    expect(await validate(dto)).toHaveLength(0);
  });

  it('should reject an empty name: renaming to nothing is not a rename', async () => {
    const dto = createDto({ name: '' });
    const errors = await validate(dto);
    const nameError = errors.find((e) => e.property === 'name');
    expect(nameError).toBeDefined();
    expect(nameError!.constraints).toHaveProperty('isNotEmpty');
  });

  it('should reject a name longer than 100 characters', async () => {
    const dto = createDto({ name: 'a'.repeat(101) });
    const errors = await validate(dto);
    const nameError = errors.find((e) => e.property === 'name');
    expect(nameError).toBeDefined();
    expect(nameError!.constraints).toHaveProperty('maxLength');
  });

  it('should accept a name of exactly 100 characters', async () => {
    const dto = createDto({ name: 'a'.repeat(100) });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('should reject a non-string name', async () => {
    const dto = createDto({ name: 123 });
    expect(await validate(dto)).not.toHaveLength(0);
  });

  it('should reject an emoji longer than 10 characters', async () => {
    const dto = createDto({ emoji: 'a'.repeat(11) });
    const errors = await validate(dto);
    const emojiError = errors.find((e) => e.property === 'emoji');
    expect(emojiError).toBeDefined();
    expect(emojiError!.constraints).toHaveProperty('maxLength');
  });

  it('should reject an empty emoji', async () => {
    const dto = createDto({ emoji: '' });
    expect(await validate(dto)).not.toHaveLength(0);
  });
});
