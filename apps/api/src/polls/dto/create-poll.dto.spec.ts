import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreatePollDto } from './create-poll.dto';

describe('CreatePollDto', () => {
  function createDto(partial: Partial<Record<string, unknown>>): CreatePollDto {
    return plainToInstance(CreatePollDto, partial);
  }

  it('should accept a date without slot (whole day)', async () => {
    const errors = await validate(createDto({ date: '2026-02-13' }));
    expect(errors.length).toBe(0);
  });

  it('should accept the three known slots', async () => {
    for (const slot of ['Mañana', 'Tarde', 'Noche']) {
      const errors = await validate(createDto({ date: '2026-02-13', slot }));
      expect(errors.length).toBe(0);
    }
  });

  it('should reject a malformed date', async () => {
    const errors = await validate(createDto({ date: '13/02/2026' }));
    const dateError = errors.find((e) => e.property === 'date');
    expect(dateError).toBeDefined();
    expect(dateError!.constraints).toHaveProperty('matches');
  });

  it('should reject impossible calendar dates', async () => {
    for (const date of ['2026-02-30', '2026-13-01', '2026-00-10', '2026-06-31', '2026-04-31']) {
      const errors = await validate(createDto({ date }));
      const dateError = errors.find((e) => e.property === 'date');
      expect(dateError).toBeDefined();
    }
  });

  it('should reject an unknown slot', async () => {
    const errors = await validate(createDto({ date: '2026-02-13', slot: 'Madrugada' }));
    const slotError = errors.find((e) => e.property === 'slot');
    expect(slotError).toBeDefined();
    expect(slotError!.constraints).toHaveProperty('isIn');
  });
});
