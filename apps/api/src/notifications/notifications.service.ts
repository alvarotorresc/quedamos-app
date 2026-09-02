import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { initializeApp, cert } from 'firebase-admin/app';
import { getMessaging, type MulticastMessage } from 'firebase-admin/messaging';
import { PrismaService } from '../common/prisma/prisma.service';
import { RegisterTokenDto } from './dto/register-token.dto';
import {
  UpdatePreferenceDto,
  NotificationType,
  NOTIFICATION_TYPES,
} from './dto/update-preference.dto';

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private firebaseInitialized = false;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  onModuleInit() {
    const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY');

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn('Firebase credentials not configured — push notifications disabled');
      return;
    }

    const pem = this.resolvePrivateKey(privateKey);
    if (!pem) {
      this.logger.error(
        'FIREBASE_PRIVATE_KEY is neither a base64-encoded PEM nor a raw PEM — push notifications disabled. ' +
          'Provide the service account private_key base64-encoded (recommended) or as raw PEM.',
      );
      return;
    }

    try {
      initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey: pem,
        }),
      });
      this.firebaseInitialized = true;
      this.logger.log('Firebase Admin SDK initialized');
    } catch (error) {
      this.logger.error(
        'Failed to initialize Firebase Admin SDK — push notifications disabled',
        error,
      );
    }
  }

  private resolvePrivateKey(rawValue: string): string | null {
    const decoded = Buffer.from(rawValue, 'base64').toString('utf-8');
    if (decoded.startsWith('-----BEGIN')) {
      return decoded;
    }

    const unescaped = rawValue.replace(/\\n/g, '\n');
    if (unescaped.startsWith('-----BEGIN')) {
      this.logger.warn('FIREBASE_PRIVATE_KEY is not base64 — falling back to raw PEM value');
      return unescaped;
    }

    return null;
  }

  isFirebaseInitialized(): boolean {
    return this.firebaseInitialized;
  }

  private static readonly MAX_TOKENS_PER_USER = 10;

  async registerToken(userId: string, dto: RegisterTokenDto) {
    const existing = await this.prisma.pushToken.findUnique({
      where: { userId_token: { userId, token: dto.token } },
    });

    if (!existing) {
      const tokenCount = await this.prisma.pushToken.count({ where: { userId } });
      if (tokenCount >= NotificationsService.MAX_TOKENS_PER_USER) {
        // Delete oldest token to make room — only for a genuinely new token, never when
        // the caller is just re-sending a token we already have registered.
        const oldest = await this.prisma.pushToken.findFirst({
          where: { userId },
          orderBy: { createdAt: 'asc' },
        });
        if (oldest) {
          await this.prisma.pushToken.delete({ where: { id: oldest.id } });
        }
      }
    }

    return this.prisma.pushToken.upsert({
      where: {
        userId_token: {
          userId,
          token: dto.token,
        },
      },
      update: {
        platform: dto.platform,
      },
      create: {
        userId,
        token: dto.token,
        platform: dto.platform,
      },
    });
  }

  async unregisterToken(userId: string, token: string) {
    await this.prisma.pushToken.deleteMany({
      where: { userId, token },
    });

    return { success: true };
  }

  async getPreferences(userId: string) {
    const saved = await this.prisma.notificationPreference.findMany({
      where: { userId },
    });
    const savedMap = new Map(saved.map((p) => [p.type, p.enabled]));

    return NOTIFICATION_TYPES.map((type) => ({
      type,
      enabled: savedMap.get(type) ?? true,
    }));
  }

  async updatePreference(userId: string, dto: UpdatePreferenceDto) {
    return this.prisma.notificationPreference.upsert({
      where: {
        userId_type: { userId, type: dto.type },
      },
      update: { enabled: dto.enabled },
      create: { userId, type: dto.type, enabled: dto.enabled },
    });
  }

  async isNotificationEnabled(userId: string, type: NotificationType): Promise<boolean> {
    const pref = await this.prisma.notificationPreference.findUnique({
      where: {
        userId_type: { userId, type },
      },
    });
    return pref?.enabled ?? true;
  }

  async sendToUser(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, string>,
    notificationType?: NotificationType,
  ) {
    if (notificationType) {
      const enabled = await this.isNotificationEnabled(userId, notificationType);
      if (!enabled) return { sent: 0 };
    }

    const tokens = await this.prisma.pushToken.findMany({
      where: { userId },
    });

    if (tokens.length === 0) return { sent: 0 };

    const result = await this.sendToTokens(
      tokens.map((t) => ({ token: t.token, platform: t.platform })),
      title,
      body,
      data,
    );

    await this.logNotification(userId, title, body, data, notificationType, result);

    return { sent: result.sent };
  }

  async sendTestNotification(
    userId: string,
    dto: { type?: NotificationType; title?: string; body?: string },
  ): Promise<{ sent: number }> {
    const title = dto.title ?? 'Test notification';
    const body = dto.body ?? 'If you see this, notifications are working!';
    const data: Record<string, string> = { type: 'test' };

    const tokens = await this.prisma.pushToken.findMany({
      where: { userId },
    });

    if (tokens.length === 0) return { sent: 0 };

    const result = await this.sendToTokens(
      tokens.map((t) => ({ token: t.token, platform: t.platform })),
      title,
      body,
      data,
    );

    // Prefix the persisted type so test sends are distinguishable from real
    // notifications in notification_logs / getDebugInfo.
    const loggedType = dto.type ? `test:${dto.type}` : 'test';
    await this.logNotification(userId, title, body, data, loggedType, result);

    return { sent: result.sent };
  }

  async getDebugInfo(userId: string) {
    const [tokens, preferences, recentLogs] = await Promise.all([
      this.prisma.pushToken.findMany({
        where: { userId },
      }),
      this.getPreferences(userId),
      this.prisma.notificationLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    return { tokens, preferences, recentLogs };
  }

  async sendToGroup(
    groupId: string,
    title: string,
    body: string,
    excludeUserId?: string,
    data?: Record<string, string>,
    notificationType?: NotificationType,
  ) {
    const members = await this.prisma.groupMember.findMany({
      where: { groupId },
    });

    const allUserIds = members.map((m) => m.userId);
    let userIds = allUserIds.filter((id) => id !== excludeUserId);

    if (notificationType && userIds.length > 0) {
      const disabledPrefs = await this.prisma.notificationPreference.findMany({
        where: { userId: { in: userIds }, type: notificationType, enabled: false },
      });
      const disabledSet = new Set(disabledPrefs.map((p) => p.userId));
      userIds = userIds.filter((id) => !disabledSet.has(id));
    }

    this.logger.debug(
      `sendToGroup: group=${groupId}, members=${allUserIds.length}, exclude=${excludeUserId}, remaining=${userIds.length}`,
    );

    if (userIds.length === 0) return { sent: 0 };

    const tokens = await this.prisma.pushToken.findMany({
      where: {
        userId: { in: userIds },
      },
    });

    if (tokens.length === 0) return { sent: 0 };

    return this.sendToTokens(
      tokens.map((t) => ({ token: t.token, platform: t.platform })),
      title,
      body,
      data,
    );
  }

  async sendToEventAttendees(
    eventId: string,
    title: string,
    body: string,
    excludeUserId?: string,
    data?: Record<string, string>,
    notificationType?: NotificationType,
    statusFilter?: string,
  ) {
    const where: Record<string, unknown> = { eventId };
    if (statusFilter) {
      where.status = statusFilter;
    }

    const attendees = await this.prisma.eventAttendee.findMany({ where });

    let userIds = attendees.map((a) => a.userId).filter((id) => id !== excludeUserId);

    if (notificationType && userIds.length > 0) {
      const disabledPrefs = await this.prisma.notificationPreference.findMany({
        where: { userId: { in: userIds }, type: notificationType, enabled: false },
      });
      const disabledSet = new Set(disabledPrefs.map((p) => p.userId));
      userIds = userIds.filter((id) => !disabledSet.has(id));
    }

    if (userIds.length === 0) return { sent: 0 };

    const tokens = await this.prisma.pushToken.findMany({
      where: { userId: { in: userIds } },
    });

    if (tokens.length === 0) return { sent: 0 };

    return this.sendToTokens(
      tokens.map((t) => ({ token: t.token, platform: t.platform })),
      title,
      body,
      data,
    );
  }

  /**
   * Splits the send by platform to avoid duplicate web notifications.
   *
   * @firebase/messaging shows its own notification whenever the FCM payload carries a
   * top-level `notification` AND onBackgroundMessage also fires — the two are not
   * mutually exclusive. Our service worker's onBackgroundMessage already shows the
   * intended notification (with routing + action buttons), so the SDK's own copy was a
   * duplicate. Web tokens now get a data-only payload (no `notification`, no
   * `webpush.notification`); the SW and the foreground handler read title/body from
   * `data` instead. Android is unaffected — same payload shape as before.
   *
   * Any token whose platform isn't recognized as 'web' is treated as native/android
   * (today's full payload) — an unexpected or missing platform value must never silently
   * degrade to a data-only push a user can't see.
   */
  private async sendToTokens(
    tokens: TokenEntry[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<SendResult> {
    if (!this.firebaseInitialized) {
      this.logger.debug(
        `Would send "${title}" to ${tokens.length} devices (Firebase not initialized)`,
      );
      return { sent: 0, failed: 0, tokenCount: tokens.length };
    }

    const webTokens = tokens.filter((t) => t.platform === 'web').map((t) => t.token);
    const androidTokens = tokens.filter((t) => t.platform !== 'web').map((t) => t.token);

    const [androidResult, webResult] = await Promise.all([
      androidTokens.length > 0
        ? this.sendBatch(androidTokens, this.buildAndroidMessage(androidTokens, title, body, data))
        : Promise.resolve({ sent: 0, failed: 0 }),
      webTokens.length > 0
        ? this.sendBatch(webTokens, this.buildWebMessage(webTokens, title, body, data))
        : Promise.resolve({ sent: 0, failed: 0 }),
    ]);

    const sent = androidResult.sent + webResult.sent;
    const failed = androidResult.failed + webResult.failed;

    this.logger.debug(`Sent "${title}" — ${sent} ok, ${failed} failed`);

    return { sent, failed, tokenCount: tokens.length };
  }

  private buildAndroidMessage(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): MulticastMessage {
    return {
      tokens,
      notification: { title, body },
      data,
      android: {
        notification: {
          channelId: 'default',
          icon: 'ic_launcher',
        },
      },
    };
  }

  private buildWebMessage(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): MulticastMessage {
    return {
      tokens,
      data: {
        ...data,
        title,
        body,
      },
    };
  }

  private async sendBatch(
    tokens: string[],
    message: MulticastMessage,
  ): Promise<{ sent: number; failed: number }> {
    try {
      const response = await getMessaging().sendEachForMulticast(message);

      if (response.failureCount > 0) {
        const invalidTokens: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (resp.error) {
            this.logger.warn(
              `FCM error for token ${tokens[idx].slice(0, 8)}...: ${resp.error.code} — ${resp.error.message}`,
            );
          }
          if (
            resp.error &&
            (resp.error.code === 'messaging/registration-token-not-registered' ||
              resp.error.code === 'messaging/invalid-registration-token')
          ) {
            invalidTokens.push(tokens[idx]);
          }
        });

        if (invalidTokens.length > 0) {
          await this.prisma.pushToken.deleteMany({
            where: { token: { in: invalidTokens } },
          });
          this.logger.log(`Cleaned ${invalidTokens.length} invalid token(s)`);
        }
      }

      return { sent: response.successCount, failed: response.failureCount };
    } catch (error) {
      this.logger.error('FCM multicast error', error);
      return { sent: 0, failed: tokens.length };
    }
  }

  private async logNotification(
    userId: string,
    title: string,
    body: string,
    data: Record<string, string> | undefined,
    notificationType: string | undefined,
    result: SendResult,
  ): Promise<void> {
    try {
      await this.prisma.notificationLog.create({
        data: {
          userId,
          type: notificationType ?? null,
          title,
          body,
          data: data ?? undefined,
          tokenCount: result.tokenCount,
          sentCount: result.sent,
          failedCount: result.failed,
        },
      });
    } catch (error) {
      this.logger.error('Failed to create notification log', error);
    }
  }
}

interface SendResult {
  sent: number;
  failed: number;
  tokenCount: number;
}

interface TokenEntry {
  token: string;
  platform: string;
}
