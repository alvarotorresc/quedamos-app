import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { RespondEventDto } from './respond-event.dto';

describe('RespondEventDto', () => {
  function createDto(
    partial: Partial<Record<string, unknown>>,
  ): RespondEventDto {
    return plainToInstance(RespondEventDto, partial);
  }

  it('should accept status "confirmed"', async () => {
    const dto = createDto({ status: 'confirmed' });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should accept status "declined"', async () => {
    const dto = createDto({ status: 'declined' });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should reject missing status', async () => {
    const dto = createDto({});
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('status');
  });

  it('should reject invalid status value', async () => {
    const dto = createDto({ status: 'pending' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const statusError = errors.find((e) => e.property === 'status');
    expect(statusError).toBeDefined();
    expect(statusError!.constraints).toHaveProperty('isIn');
  });

  it('should reject non-string status', async () => {
    const dto = createDto({ status: 1 });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject "cancelled" as a status', async () => {
    const dto = createDto({ status: 'cancelled' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
