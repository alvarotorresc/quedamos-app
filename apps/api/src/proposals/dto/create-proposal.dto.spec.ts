import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateProposalDto } from './create-proposal.dto';

describe('CreateProposalDto', () => {
  function createDto(partial: Partial<Record<string, unknown>>): CreateProposalDto {
    return plainToInstance(CreateProposalDto, partial);
  }

  const validPayload = { title: 'Friday Plans' };

  describe('online proposal fields', () => {
    it('should accept valid isOnline boolean', async () => {
      const dto = createDto({ ...validPayload, isOnline: true });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should reject non-boolean isOnline', async () => {
      const dto = createDto({ ...validPayload, isOnline: 'yes' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const onlineError = errors.find((e) => e.property === 'isOnline');
      expect(onlineError).toBeDefined();
      expect(onlineError!.constraints).toHaveProperty('isBoolean');
    });

    it('should accept valid URL for meetingUrl', async () => {
      const dto = createDto({
        ...validPayload,
        isOnline: true,
        meetingUrl: 'https://meet.google.com/abc-defg-hij',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should reject invalid URL for meetingUrl', async () => {
      const dto = createDto({
        ...validPayload,
        meetingUrl: 'not-a-url',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const urlError = errors.find((e) => e.property === 'meetingUrl');
      expect(urlError).toBeDefined();
      expect(urlError!.constraints).toHaveProperty('isUrl');
    });

    it('should reject meetingUrl longer than 500 chars', async () => {
      const dto = createDto({
        ...validPayload,
        meetingUrl: 'https://meet.google.com/' + 'a'.repeat(500),
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const urlError = errors.find((e) => e.property === 'meetingUrl');
      expect(urlError).toBeDefined();
      expect(urlError!.constraints).toHaveProperty('maxLength');
    });
  });

  describe('proposedDate validation', () => {
    it('should reject impossible calendar dates', async () => {
      for (const proposedDate of ['2026-02-30', '2026-13-01', '2026-06-31']) {
        const dto = createDto({ ...validPayload, proposedDate });
        const errors = await validate(dto);
        const dateError = errors.find((e) => e.property === 'proposedDate');
        expect(dateError).toBeDefined();
      }
    });
  });
});
