import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { randomInt } from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateGroupDto } from './dto/create-group.dto';

@Injectable()
export class GroupsService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  private generateInviteCode(): string {
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += randomInt(0, 10).toString();
    }
    return code;
  }

  private async generateUniqueInviteCode(): Promise<string> {
    for (let i = 0; i < 5; i++) {
      const code = this.generateInviteCode();
      const existing = await this.prisma.group.findUnique({
        where: { inviteCode: code },
      });
      if (!existing) return code;
    }
    throw new InternalServerErrorException('Failed to create group, please try again');
  }

  async create(userId: string, dto: CreateGroupDto) {
    const inviteCode = await this.generateUniqueInviteCode();

    const group = await this.prisma.group.create({
      data: {
        name: dto.name,
        emoji: dto.emoji ?? '👥',
        inviteCode,
        createdById: userId,
        members: {
          create: {
            userId,
          },
        },
      },
      include: {
        members: {
          include: { user: true },
        },
      },
    });

    return group;
  }

  async findAllForUser(userId: string) {
    return this.prisma.group.findMany({
      where: {
        members: {
          some: { userId },
        },
      },
      include: {
        members: {
          include: { user: true },
        },
      },
    });
  }

  async findById(groupId: string, userId: string) {
    const group = await this.prisma.group.findFirst({
      where: {
        id: groupId,
        members: {
          some: { userId },
        },
      },
      include: {
        members: {
          include: { user: true },
        },
      },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    return group;
  }

  async joinByCode(userId: string, inviteCode: string) {
    const group = await this.prisma.group.findUnique({
      where: { inviteCode },
    });

    if (!group) {
      throw new NotFoundException('Invalid invite code');
    }

    const existingMember = await this.prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId: group.id,
          userId,
        },
      },
    });

    if (existingMember) {
      throw new BadRequestException('Already a member of this group');
    }

    await this.prisma.groupMember.create({
      data: {
        groupId: group.id,
        userId,
      },
    });

    // Backfill: add new member as attendee to all active future events
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const activeEvents = await this.prisma.event.findMany({
      where: {
        groupId: group.id,
        status: { not: 'cancelled' },
        date: { gte: today },
      },
    });

    if (activeEvents.length > 0) {
      await this.prisma.eventAttendee.createMany({
        data: activeEvents.map((event: { id: string }) => ({
          eventId: event.id,
          userId,
          status: 'pending',
        })),
        skipDuplicates: true,
      });
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      this.notificationsService
        .sendToGroup(
          group.id,
          'Nuevo miembro',
          `${user.name} se ha unido a "${group.name}"`,
          userId,
          { type: 'member_joined', groupId: group.id },
        )
        .catch(() => {});
    }

    return this.findById(group.id, userId);
  }

  async leave(groupId: string, userId: string) {
    const membership = await this.prisma.groupMember.findUnique({
      where: {
        groupId_userId: { groupId, userId },
      },
    });

    if (!membership) {
      throw new NotFoundException('Not a member of this group');
    }

    const [user, group] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.group.findUnique({ where: { id: groupId } }),
    ]);

    await this.prisma.groupMember.delete({
      where: {
        groupId_userId: { groupId, userId },
      },
    });

    if (user && group) {
      this.notificationsService
        .sendToGroup(
          groupId,
          'Miembro salió',
          `${user.name} ha salido de "${group.name}"`,
          userId,
          { type: 'member_left', groupId },
        )
        .catch(() => {});
    }

    return { success: true };
  }

  async getMembers(groupId: string, userId: string) {
    await this.findById(groupId, userId);

    return this.prisma.groupMember.findMany({
      where: { groupId },
      include: { user: true },
    });
  }

  async getInviteInfo(groupId: string, userId: string) {
    const group = await this.findById(groupId, userId);
    return {
      inviteCode: group.inviteCode,
      inviteUrl: `${process.env.APP_URL || 'https://quedamos-app-mobile.vercel.app'}/join/${group.inviteCode}`,
    };
  }

  async refreshInviteCode(groupId: string, userId: string) {
    await this.findById(groupId, userId);

    const newCode = await this.generateUniqueInviteCode();

    await this.prisma.group.update({
      where: { id: groupId },
      data: { inviteCode: newCode },
    });

    return {
      inviteCode: newCode,
      inviteUrl: `${process.env.APP_URL || 'https://quedamos-app-mobile.vercel.app'}/join/${newCode}`,
    };
  }
}
