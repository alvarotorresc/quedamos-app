import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GetWidgetSummaryQueryDto } from './get-widget-summary-query.dto';

async function errorsFor(input: Record<string, string>) {
  return validate(plainToInstance(GetWidgetSummaryQueryDto, input));
}

const VALID = {
  groupId: '4c2c1c68-6a15-4c9a-9e3b-1a2b3c4d5e6f',
  weekStart: '2026-08-31',
  today: '2026-09-02',
};

describe('GetWidgetSummaryQueryDto', () => {
  it('accepts a valid query', async () => {
    expect(await errorsFor(VALID)).toHaveLength(0);
  });

  it.each(['groupId', 'weekStart', 'today'])('rejects a missing %s', async (field) => {
    const input = { ...VALID };
    delete input[field as keyof typeof VALID];
    expect((await errorsFor(input)).length).toBeGreaterThan(0);
  });

  it('rejects a non-uuid groupId', async () => {
    expect((await errorsFor({ ...VALID, groupId: 'nope' })).length).toBeGreaterThan(0);
  });

  it.each(['2026-9-1', '20260901', 'hoy'])('rejects malformed date %s', async (bad) => {
    expect((await errorsFor({ ...VALID, weekStart: bad })).length).toBeGreaterThan(0);
    expect((await errorsFor({ ...VALID, today: bad })).length).toBeGreaterThan(0);
  });
});
