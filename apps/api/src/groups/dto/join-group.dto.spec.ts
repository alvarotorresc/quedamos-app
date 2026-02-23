import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { JoinGroupDto } from './join-group.dto';

describe('JoinGroupDto', () => {
  function createDto(partial: Partial<Record<string, unknown>>): JoinGroupDto {
    return plainToInstance(JoinGroupDto, partial);
  }

  it('should accept valid 8-digit invite code', async () => {
    const dto = createDto({ inviteCode: '12345678' });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should reject missing inviteCode', async () => {
    const dto = createDto({});
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('inviteCode');
  });

  it('should reject non-string inviteCode', async () => {
    const dto = createDto({ inviteCode: 12345678 });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject code shorter than 8 digits', async () => {
    const dto = createDto({ inviteCode: '1234567' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const codeError = errors.find((e) => e.property === 'inviteCode');
    expect(codeError).toBeDefined();
    expect(codeError!.constraints).toHaveProperty('matches');
  });

  it('should reject code longer than 8 digits', async () => {
    const dto = createDto({ inviteCode: '123456789' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject code with non-digit characters', async () => {
    const dto = createDto({ inviteCode: 'ABCD1234' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject code with special characters', async () => {
    const dto = createDto({ inviteCode: '1234-567' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
