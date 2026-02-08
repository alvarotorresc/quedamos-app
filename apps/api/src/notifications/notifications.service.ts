import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import { RegisterTokenDto } from './dto/register-token.dto';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

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

  async sendToUser(userId: string, title: string, body: string) {
    const tokens = await this.prisma.pushToken.findMany({
      where: { userId },
    });

    // TODO: Implement FCM sending
    console.log(`Would send to ${tokens.length} devices for user ${userId}:`, {
      title,
      body,
    });

    return { sent: tokens.length };
  }

  async sendToGroup(groupId: string, title: string, body: string) {
    const members = await this.prisma.groupMember.findMany({
      where: { groupId },
    });

    const tokens = await this.prisma.pushToken.findMany({
      where: {
        userId: {
          in: members.map((m) => m.userId),
        },
      },
    });

    // TODO: Implement FCM sending
    console.log(`Would send to ${tokens.length} devices for group ${groupId}:`, {
      title,
      body,
    });

    return { sent: tokens.length };
  }
}
