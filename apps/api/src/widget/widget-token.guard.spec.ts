import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { WidgetTokenGuard } from './widget-token.guard';
import { createTestUser } from '../common/test-utils';

function contextWithAuth(header?: string): ExecutionContext {
  const request: { headers: Record<string, string | undefined>; user?: unknown } = {
    headers: { authorization: header },
  };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('WidgetTokenGuard', () => {
  const validate = jest.fn();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const guard = new WidgetTokenGuard({ validate } as any);

  beforeEach(() => validate.mockReset());

  it('rejects a missing authorization header', async () => {
    await expect(guard.canActivate(contextWithAuth(undefined))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a non-bearer header', async () => {
    await expect(guard.canActivate(contextWithAuth('Basic abc'))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects when the service does not recognize the token', async () => {
    validate.mockResolvedValue(null);
    await expect(guard.canActivate(contextWithAuth('Bearer qw_bad'))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('accepts a valid token and attaches the user to the request', async () => {
    const user = createTestUser();
    validate.mockResolvedValue(user);
    const ctx = contextWithAuth('Bearer qw_good');
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(validate).toHaveBeenCalledWith('qw_good');
    expect(ctx.switchToHttp().getRequest().user).toEqual(user);
  });
});
