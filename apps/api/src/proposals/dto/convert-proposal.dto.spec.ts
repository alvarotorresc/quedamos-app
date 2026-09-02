import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ConvertProposalDto } from './convert-proposal.dto';

describe('ConvertProposalDto', () => {
  function createDto(partial: Partial<Record<string, unknown>>): ConvertProposalDto {
    return plainToInstance(ConvertProposalDto, partial);
  }

  it('should accept a date with optional times', async () => {
    const errors = await validate(createDto({ date: '2026-03-20', time: '20:00' }));
    expect(errors.length).toBe(0);
  });

  it('should reject a malformed date', async () => {
    const errors = await validate(createDto({ date: '20/03/2026' }));
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
});
