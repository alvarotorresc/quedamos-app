import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UnregisterTokenDto } from './unregister-token.dto';

describe('UnregisterTokenDto', () => {
  function createDto(
    partial: Partial<Record<string, unknown>>,
  ): UnregisterTokenDto {
    return plainToInstance(UnregisterTokenDto, partial);
  }

  it('should accept valid token string', async () => {
    const dto = createDto({ token: 'fcm-token-abc123' });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should reject missing token', async () => {
    const dto = createDto({});
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('token');
  });

  it('should reject non-string token', async () => {
    const dto = createDto({ token: 12345 });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const tokenError = errors.find((e) => e.property === 'token');
    expect(tokenError).toBeDefined();
  });

  it('should reject boolean token', async () => {
    const dto = createDto({ token: true });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
