import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { randomInt } from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { PUBLIC_USER_SELECT } from '../common/prisma/user-select';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { AddCityDto } from './dto/add-city.dto';

/** Fields to return for group queries. Excludes inviteCode for security (SEC-18). */
const GROUP_PUBLIC_SELECT = {
  id: true,
  name: true,
  emoji: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** Group select with members included. Used by findAllForUser, findById, create, joinByCode. */
const GROUP_WITH_MEMBERS_SELECT = {
  ...GROUP_PUBLIC_SELECT,
  members: {
    include: {
      user: { select: PUBLIC_USER_SELECT },
    },
  },
} as const;

@Injectable()
export class GroupsService {
  private readonly logger = new Logger(GroupsService.name);

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
            role: 'admin',
          },
        },
      },
      select: GROUP_WITH_MEMBERS_SELECT,
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
      select: GROUP_WITH_MEMBERS_SELECT,
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
      select: GROUP_WITH_MEMBERS_SELECT,
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
          'member_joined',
        )
        .catch((err) => this.logger.error('Failed to send member_joined notification', err));
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

    if (group && group.createdById === userId) {
      throw new ForbiddenException('The group creator cannot leave. Delete the group instead.');
    }

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
          'member_left',
        )
        .catch((err) => this.logger.error('Failed to send member_left notification', err));
    }

    return { success: true };
  }

  async getMembers(groupId: string, userId: string) {
    await this.findById(groupId, userId);

    return this.prisma.groupMember.findMany({
      where: { groupId },
      include: { user: { select: PUBLIC_USER_SELECT } },
    });
  }

  async getInviteInfo(groupId: string, userId: string) {
    // Verify membership first
    await this.findById(groupId, userId);

    // Query inviteCode directly — not exposed via findById (SEC-18)
    const group = await this.prisma.group.findUniqueOrThrow({
      where: { id: groupId },
      select: { inviteCode: true },
    });

    return {
      inviteCode: group.inviteCode,
      inviteUrl: `${process.env.APP_URL || 'https://quedamos-app-mobile.vercel.app'}/join/${group.inviteCode}`,
    };
  }

  async isAdmin(groupId: string, userId: string): Promise<boolean> {
    const member = await this.prisma.groupMember.findUnique({
      where: {
        groupId_userId: { groupId, userId },
      },
    });

    return member?.role === 'admin';
  }

  async updateMemberRole(
    groupId: string,
    targetUserId: string,
    requestingUserId: string,
    role: 'admin' | 'member',
  ) {
    const admin = await this.isAdmin(groupId, requestingUserId);
    if (!admin) {
      throw new ForbiddenException('Only admins can change member roles');
    }

    const targetMember = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: targetUserId } },
    });

    if (!targetMember) {
      throw new NotFoundException('Member not found in this group');
    }

    if (role === 'member' && targetMember.role === 'admin') {
      const group = await this.prisma.group.findUnique({ where: { id: groupId } });
      if (group && group.createdById === targetUserId) {
        throw new ForbiddenException('Cannot demote the group creator');
      }

      const adminCount = await this.prisma.groupMember.count({
        where: { groupId, role: 'admin' },
      });
      if (adminCount <= 1) {
        throw new BadRequestException('There must be at least one admin');
      }
    }

    const updated = await this.prisma.groupMember.update({
      where: { groupId_userId: { groupId, userId: targetUserId } },
      data: { role },
    });

    this.notificationsService
      .sendToUser(
        targetUserId,
        'Role updated',
        `Your role has been changed to ${role}`,
        {
          type: 'role_changed',
          groupId,
        },
        'role_changed',
      )
      .catch((err) => this.logger.error('Failed to send role_changed notification', err));

    return updated;
  }

  async kickMember(groupId: string, targetUserId: string, requestingUserId: string) {
    const admin = await this.isAdmin(groupId, requestingUserId);
    if (!admin) {
      throw new ForbiddenException('Only admins can kick members');
    }

    if (targetUserId === requestingUserId) {
      throw new BadRequestException('Cannot kick yourself');
    }

    const targetMember = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: targetUserId } },
    });

    if (!targetMember) {
      throw new NotFoundException('Member not found in this group');
    }

    if (targetMember.role === 'admin') {
      throw new BadRequestException('Cannot kick an admin, demote first');
    }

    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (group && group.createdById === targetUserId) {
      throw new ForbiddenException('Cannot kick the group creator');
    }

    await this.prisma.groupMember.delete({
      where: { groupId_userId: { groupId, userId: targetUserId } },
    });

    await this.prisma.eventAttendee.deleteMany({
      where: {
        userId: targetUserId,
        event: {
          groupId,
          date: { gte: new Date() },
        },
      },
    });

    this.notificationsService
      .sendToUser(
        targetUserId,
        'Removed from group',
        'You have been removed from a group',
        {
          type: 'member_kicked',
          groupId,
        },
        'member_kicked',
      )
      .catch((err) => this.logger.error('Failed to send member_kicked notification', err));

    return { success: true };
  }

  async deleteGroup(groupId: string, userId: string) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    if (group.createdById !== userId) {
      throw new ForbiddenException('Only the group creator can delete the group');
    }

    this.notificationsService
      .sendToGroup(
        groupId,
        'Group deleted',
        `The group "${group.name}" has been deleted`,
        userId,
        {
          type: 'group_deleted',
          groupId,
        },
        'group_deleted',
      )
      .catch((err) => this.logger.error('Failed to send group_deleted notification', err));

    await this.prisma.group.delete({
      where: { id: groupId },
    });

    return { success: true };
  }

  async addCity(groupId: string, userId: string, dto: AddCityDto) {
    const admin = await this.isAdmin(groupId, userId);
    if (!admin) {
      throw new ForbiddenException('Only admins can add cities');
    }

    return this.prisma.groupCity.create({
      data: {
        groupId,
        name: dto.name,
        lat: dto.lat,
        lon: dto.lon,
      },
    });
  }

  async getCities(groupId: string, userId: string) {
    await this.findById(groupId, userId);
    return this.prisma.groupCity.findMany({
      where: { groupId },
    });
  }

  async removeCity(groupId: string, cityId: string, userId: string) {
    const admin = await this.isAdmin(groupId, userId);
    if (!admin) {
      throw new ForbiddenException('Only admins can remove cities');
    }

    const city = await this.prisma.groupCity.findFirst({
      where: { id: cityId, groupId },
    });

    if (!city) {
      throw new NotFoundException('City not found in this group');
    }

    await this.prisma.groupCity.delete({
      where: { id: cityId },
    });

    return { success: true };
  }

  async refreshInviteCode(groupId: string, userId: string) {
    await this.findById(groupId, userId);

    const admin = await this.isAdmin(groupId, userId);
    if (!admin) {
      throw new ForbiddenException('Only admins can refresh invite code');
    }

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
