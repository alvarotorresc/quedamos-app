import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
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

    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: Buffer.from(privateKey, 'base64').toString('utf-8'),
        }),
      });
      this.firebaseInitialized = true;
      this.logger.log('Firebase Admin SDK initialized');
    } catch (error) {
      this.logger.error('Failed to initialize Firebase Admin SDK', error);
    }
  }

  private static readonly MAX_TOKENS_PER_USER = 10;

  async registerToken(userId: string, dto: RegisterTokenDto) {
    const tokenCount = await this.prisma.pushToken.count({ where: { userId } });
    if (tokenCount >= NotificationsService.MAX_TOKENS_PER_USER) {
      // Delete oldest token to make room
      const oldest = await this.prisma.pushToken.findFirst({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      });
      if (oldest) {
        await this.prisma.pushToken.delete({ where: { id: oldest.id } });
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

    return this.sendToTokens(
      tokens.map((t) => t.token),
      title,
      body,
      data,
    );
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
      tokens.map((t) => t.token),
      title,
      body,
      data,
    );
  }

  private async sendToTokens(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<{ sent: number }> {
    if (!this.firebaseInitialized) {
      this.logger.debug(
        `Would send "${title}" to ${tokens.length} devices (Firebase not initialized)`,
      );
      return { sent: 0 };
    }

    const message: admin.messaging.MulticastMessage = {
      tokens,
      notification: { title, body },
      data,
      android: {
        notification: {
          channelId: 'default',
          icon: 'ic_launcher',
        },
      },
      webpush: {
        notification: {
          icon: '/logo.png',
        },
      },
    };

    try {
      const response = await admin.messaging().sendEachForMulticast(message);

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

      this.logger.debug(
        `Sent "${title}" — ${response.successCount} ok, ${response.failureCount} failed`,
      );
      return { sent: response.successCount };
    } catch (error) {
      this.logger.error('FCM multicast error', error);
      return { sent: 0 };
    }
  }
}
