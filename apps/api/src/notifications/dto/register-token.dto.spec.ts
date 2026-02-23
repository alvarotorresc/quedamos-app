import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { RegisterTokenDto } from './register-token.dto';

describe('RegisterTokenDto', () => {
  function createDto(
    partial: Partial<Record<string, unknown>>,
  ): RegisterTokenDto {
    return plainToInstance(RegisterTokenDto, partial);
  }

  it('should accept valid token with platform "web"', async () => {
    const dto = createDto({
      token: 'fcm-token-abc123',
      platform: 'web',
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should accept valid token with platform "android"', async () => {
    const dto = createDto({
      token: 'fcm-token-xyz789',
      platform: 'android',
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should reject missing token', async () => {
    const dto = createDto({ platform: 'web' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const tokenError = errors.find((e) => e.property === 'token');
    expect(tokenError).toBeDefined();
  });

  it('should reject missing platform', async () => {
    const dto = createDto({ token: 'fcm-token-abc123' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const platformError = errors.find((e) => e.property === 'platform');
    expect(platformError).toBeDefined();
  });

  it('should reject invalid platform value', async () => {
    const dto = createDto({
      token: 'fcm-token-abc123',
      platform: 'ios',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const platformError = errors.find((e) => e.property === 'platform');
    expect(platformError).toBeDefined();
    expect(platformError!.constraints).toHaveProperty('isIn');
  });

  it('should reject non-string token', async () => {
    const dto = createDto({ token: 12345, platform: 'web' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject non-string platform', async () => {
    const dto = createDto({ token: 'fcm-token', platform: 1 });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject empty object', async () => {
    const dto = createDto({});
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });
});
