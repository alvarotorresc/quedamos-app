import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { User } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

const TOKEN_PREFIX = 'qw_';

@Injectable()
export class WidgetTokenService {
  constructor(private prisma: PrismaService) {}

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async issue(userId: string): Promise<{ token: string }> {
    const token = TOKEN_PREFIX + randomBytes(24).toString('hex');
    await this.prisma.widgetToken.create({
      data: { userId, tokenHash: this.hash(token) },
    });
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
    // Best-effort usage stamp: a failed touch must never fail the request.
    await this.prisma.widgetToken
      .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
      .catch(() => {});
    return record.user;
  }
}
