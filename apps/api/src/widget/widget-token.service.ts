import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { createHash, randomBytes } from 'crypto';
import { User } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

const TOKEN_PREFIX = 'qw_';

/**
 * Widget tokens travel outside the AuthGuard: the Android widget stores one and
 * replays it on every refresh. Bound the damage of a leaked one (logcat, a device
 * backup) with a lifetime and a cap per user instead of letting every emission
 * pile up a permanent credential — syncWidgetSession can double-issue on startup.
 *
 * The lifetime is derived from created_at, so it applies to the tokens already
 * out there without a backfill and can be re-tuned without a data migration.
 */
const TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_TOKENS_PER_USER = 5;

@Injectable()
export class WidgetTokenService {
  private readonly logger = new Logger(WidgetTokenService.name);

  constructor(private prisma: PrismaService) {}

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /** Tokens created at or before this instant are no longer valid. */
  private expiryCutoff(): Date {
    return new Date(Date.now() - TOKEN_TTL_MS);
  }

  async issue(userId: string): Promise<{ token: string }> {
    const token = TOKEN_PREFIX + randomBytes(24).toString('hex');
    await this.prisma.widgetToken.create({
      data: { userId, tokenHash: this.hash(token) },
    });

    // Keep only the newest MAX_TOKENS_PER_USER. Pruning after the insert means the
    // token just issued is always the freshest and never evicts itself.
    const surplus = await this.prisma.widgetToken.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: MAX_TOKENS_PER_USER,
      select: { id: true },
    });
    if (surplus.length > 0) {
      await this.prisma.widgetToken.deleteMany({
        where: { id: { in: surplus.map((t) => t.id) } },
      });
    }

    return { token };
  }

  async revokeAll(userId: string): Promise<{ success: true }> {
    await this.prisma.widgetToken.deleteMany({ where: { userId } });
    return { success: true };
  }

  async validate(token: string): Promise<User | null> {
    if (!token.startsWith(TOKEN_PREFIX)) return null;
    const record = await this.prisma.widgetToken.findUnique({
      where: { tokenHash: this.hash(token) },
      include: { user: true },
    });
    if (!record) return null;

    if (record.createdAt <= this.expiryCutoff()) {
      // Best-effort cleanup: a failed delete must not turn a rejection into a 500.
      await this.prisma.widgetToken.delete({ where: { id: record.id } }).catch(() => {});
      return null;
    }

    // Best-effort usage stamp: a failed touch must never fail the request.
    await this.prisma.widgetToken
      .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
      .catch(() => {});
    return record.user;
  }

  /** Sweeps the tokens whose lifetime ran out but that nobody tried to use again. */
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async purgeExpired(): Promise<void> {
    const { count } = await this.prisma.widgetToken.deleteMany({
      where: { createdAt: { lt: this.expiryCutoff() } },
    });
    if (count > 0) {
      this.logger.log(`Purged ${count} expired widget token(s)`);
    }
  }
}
