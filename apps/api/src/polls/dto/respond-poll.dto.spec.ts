import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { RespondPollDto } from './respond-poll.dto';

describe('RespondPollDto', () => {
  function createDto(partial: Partial<Record<string, unknown>>): RespondPollDto {
    return plainToInstance(RespondPollDto, partial);
  }

  it('should accept the three answers', async () => {
    for (const answer of ['yes', 'no', 'unsure']) {
      const errors = await validate(createDto({ answer }));
      expect(errors.length).toBe(0);
    }
  });

  it('should reject anything else', async () => {
    const errors = await validate(createDto({ answer: 'maybe' }));
    const answerError = errors.find((e) => e.property === 'answer');
    expect(answerError).toBeDefined();
    expect(answerError!.constraints).toHaveProperty('isIn');
  });

  it('should reject a missing answer', async () => {
    const errors = await validate(createDto({}));
    expect(errors.length).toBeGreaterThan(0);
  });
});
