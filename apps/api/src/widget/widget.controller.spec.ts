import { WidgetController } from './widget.controller';
import { createTestUser } from '../common/test-utils';

describe('WidgetController', () => {
  const tokenService = { issue: jest.fn(), revokeAll: jest.fn() };
  const summaryService = { getSummary: jest.fn() };
  const controller = new WidgetController(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tokenService as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    summaryService as any,
  );
  const user = createTestUser();

  it('issues a token for the current user', async () => {
    tokenService.issue.mockResolvedValue({ token: 'qw_x' });
    await expect(controller.issueToken(user)).resolves.toEqual({ token: 'qw_x' });
    expect(tokenService.issue).toHaveBeenCalledWith(user.id);
  });

  it('revokes every token of the current user', async () => {
    tokenService.revokeAll.mockResolvedValue({ success: true });
    await expect(controller.revokeTokens(user)).resolves.toEqual({ success: true });
    expect(tokenService.revokeAll).toHaveBeenCalledWith(user.id);
  });

  it('delegates the summary to the service with the query params', async () => {
    summaryService.getSummary.mockResolvedValue({ bestDay: null });
    const query = { groupId: 'group-1', weekStart: '2026-08-31', today: '2026-09-02' };
    await controller.getSummary(user, query);
    expect(summaryService.getSummary).toHaveBeenCalledWith(
      user.id,
      'group-1',
      '2026-08-31',
      '2026-09-02',
    );
  });
});
