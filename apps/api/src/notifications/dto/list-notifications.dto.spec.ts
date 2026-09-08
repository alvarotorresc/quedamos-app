import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { INBOX_MAX_LIMIT, ListNotificationsDto } from './list-notifications.dto';

function validate(query: Record<string, unknown>) {
  return validateSync(plainToInstance(ListNotificationsDto, query));
}

describe('ListNotificationsDto', () => {
  it('should accept an empty query', () => {
    expect(validate({})).toHaveLength(0);
  });

  it('should coerce the limit coming off the query string', () => {
    const dto = plainToInstance(ListNotificationsDto, { limit: '10' });

    expect(dto.limit).toBe(10);
    expect(validateSync(dto)).toHaveLength(0);
  });

  it('should reject a limit above the cap', () => {
    expect(validate({ limit: String(INBOX_MAX_LIMIT + 1) })).not.toHaveLength(0);
  });

  it('should reject a limit below one', () => {
    expect(validate({ limit: '0' })).not.toHaveLength(0);
  });

  it('should reject a non-numeric limit', () => {
    expect(validate({ limit: 'all' })).not.toHaveLength(0);
  });

  it('should reject a cursor that is not a uuid', () => {
    expect(validate({ cursor: 'not-an-id' })).not.toHaveLength(0);
  });

  it('should accept a uuid cursor', () => {
    expect(validate({ cursor: '11111111-1111-4111-8111-111111111111' })).toHaveLength(0);
  });
});
