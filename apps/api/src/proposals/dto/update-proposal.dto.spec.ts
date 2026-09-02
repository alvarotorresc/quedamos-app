import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateProposalDto } from './update-proposal.dto';

describe('UpdateProposalDto', () => {
  function createDto(partial: Partial<Record<string, unknown>>): UpdateProposalDto {
    return plainToInstance(UpdateProposalDto, partial);
  }

  it('should accept a real proposedDate', async () => {
    const errors = await validate(createDto({ proposedDate: '2026-03-20' }));
    expect(errors.length).toBe(0);
  });

  it('should reject impossible calendar dates', async () => {
    for (const proposedDate of ['2026-02-30', '2026-13-01', '2026-06-31']) {
      const errors = await validate(createDto({ proposedDate }));
      const dateError = errors.find((e) => e.property === 'proposedDate');
      expect(dateError).toBeDefined();
    }
  });
});
