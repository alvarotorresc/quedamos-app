import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
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
      code += Math.floor(Math.random() * 10).toString();
    }
    return code;
  }

  async create(userId: string, dto: CreateGroupDto) {
    const inviteCode = this.generateInviteCode();

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
      inviteUrl: `https://quedamos.app/join/${group.inviteCode}`,
    };
  }

  async refreshInviteCode(groupId: string, userId: string) {
    await this.findById(groupId, userId);

    const newCode = this.generateInviteCode();

    await this.prisma.group.update({
      where: { id: groupId },
      data: { inviteCode: newCode },
    });

    return {
      inviteCode: newCode,
      inviteUrl: `https://quedamos.app/join/${newCode}`,
    };
  }
}
