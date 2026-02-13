import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { createTestUser } from '../common/test-utils';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let authService: { validateToken: jest.Mock };

  beforeEach(() => {
    authService = { validateToken: jest.fn() };
    guard = new AuthGuard(authService as unknown as AuthService);
  });

  function createMockContext(authHeader?: string) {
    const request = {
      headers: { authorization: authHeader },
      user: undefined as any,
    };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      request,
    } as unknown as ExecutionContext & { request: typeof request };
  }

  it('should allow request with valid token', async () => {
    const user = createTestUser();
    authService.validateToken.mockResolvedValue(user as any);
    const ctx = createMockContext('Bearer valid-token');

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(authService.validateToken).toHaveBeenCalledWith('valid-token');
  });

  it('should set user on request', async () => {
    const user = createTestUser();
    authService.validateToken.mockResolvedValue(user as any);
    const ctx = createMockContext('Bearer valid-token');

    await guard.canActivate(ctx);

    expect((ctx as any).request.user).toEqual(user);
  });

  it('should throw when no authorization header', async () => {
    const ctx = createMockContext(undefined);

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw when authorization header is not Bearer', async () => {
    const ctx = createMockContext('Basic credentials');

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });
});
