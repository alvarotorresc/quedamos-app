import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { PrismaService } from '../common/prisma/prisma.service';
import { RegisterTokenDto } from './dto/register-token.dto';

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
      this.logger.warn(
        'Firebase credentials not configured — push notifications disabled',
      );
      return;
    }

    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
      });
      this.firebaseInitialized = true;
      this.logger.log('Firebase Admin SDK initialized');
    } catch (error) {
      this.logger.error('Failed to initialize Firebase Admin SDK', error);
    }
  }

  async registerToken(userId: string, dto: RegisterTokenDto) {
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

  async sendToUser(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ) {
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
  ) {
    const members = await this.prisma.groupMember.findMany({
      where: { groupId },
    });

    const userIds = members
      .map((m) => m.userId)
      .filter((id) => id !== excludeUserId);

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
