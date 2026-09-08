import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '../src/auth/auth.guard';
import { AuthService } from '../src/auth/auth.service';
import { PrismaService } from '../src/common/prisma/prisma.service';

/** Header the e2e tests send instead of a Supabase JWT. Its value is the user's id. */
export const TEST_USER_HEADER = 'x-test-user';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Stands in for AuthGuard in the e2e app. A request carrying `x-test-user: <uuid>` runs as
 * that user, which keeps the suite independent from Supabase Auth; a request without it goes
 * through the real guard, so the anonymous path (401) is exercised as in production.
 */
@Injectable()
export class TestAuthGuard implements CanActivate {
  private readonly realGuard: AuthGuard;

  constructor(
    authService: AuthService,
    private readonly prisma: PrismaService,
  ) {
    this.realGuard = new AuthGuard(authService);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: unknown }>();
    const userId = request.header(TEST_USER_HEADER);

    if (!userId) {
      return this.realGuard.canActivate(context);
    }

    if (!UUID_REGEX.test(userId)) {
      throw new UnauthorizedException(`${TEST_USER_HEADER} must be a user id`);
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Unknown test user');
    }

    request.user = user;
    return true;
  }
}
