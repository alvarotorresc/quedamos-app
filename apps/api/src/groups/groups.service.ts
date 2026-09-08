import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  ConflictException,
} from '@nestjs/common';
import { randomInt } from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { PUBLIC_USER_SELECT } from '../common/prisma/user-select';
import { getFrontendUrl } from '../common/frontend-url';
import { startOfTodayUTC } from '../common/date-utils';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { AddCityDto } from './dto/add-city.dto';
import { UpdateGroupDto } from './dto/update-group.dto';

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
  private static readonly MAX_CITIES_PER_GROUP = 5;

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
      // This message literal is load-bearing: pre-v1.0.0 clients detect membership conflicts by matching this exact string.
      throw new ConflictException('Already a member of this group');
    }

    await this.prisma.groupMember.create({
      data: {
        groupId: group.id,
        userId,
      },
    });

    // Backfill: add new member as attendee to all active future events
    const today = startOfTodayUTC();
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
          'member_joined',
          { actorName: user.name, groupName: group.name },
          userId,
          { groupId: group.id },
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

    await this.removeMemberContributions(groupId, userId);
    await this.recomputeAfterMemberRemoval(groupId);

    if (user && group) {
      this.notificationsService
        .sendToGroup(
          groupId,
          'member_left',
          { actorName: user.name, groupName: group.name },
          userId,
          { groupId },
        )
        .catch((err) => this.logger.error('Failed to send member_left notification', err));
    }

    return { success: true };
  }

  /**
   * What a member leaves behind when they go, whether they left or were kicked.
   *
   * One rule for everything: what is dated before today stays, what is dated today or
   * later goes. Their availability and their answers no longer count for anybody
   * planning something, and a stale vote would put a non-member in the attendee list of
   * a proposal converted later on — but the group's history is not theirs alone to
   * erase, and leaving is not a way to wipe it. Before this, availability, poll answers
   * and votes were deleted whole, past included, while only attendance was filtered.
   *
   * Votes are the exception to the date rule: a proposal has no date until it is
   * converted, so only the votes of proposals still open are dropped.
   */
  private async removeMemberContributions(groupId: string, userId: string) {
    const today = this.startOfTodayInMadrid();

    await this.prisma.availability.deleteMany({
      where: { groupId, userId, date: { gte: today } },
    });
    await this.prisma.eventAttendee.deleteMany({
      where: { userId, event: { groupId, date: { gte: today } } },
    });
    await this.prisma.pollResponse.deleteMany({
      where: { userId, poll: { groupId, date: { gte: today } } },
    });
    await this.prisma.planVote.deleteMany({
      where: { userId, proposal: { groupId, status: 'open' } },
    });
  }

  /**
   * Today in Madrid as the UTC-midnight instant the `@db.Date` columns store. Deliberate
   * twin of the helper in WeeklyReminderService: v0.1 hardcodes the group timezone in
   * each place that needs it, and v0.2 will lift them together when it becomes a group
   * setting. Reading the server's own day moves the boundary by an hour or two and, late
   * at night, would take today's quedada down with tomorrow's.
   */
  private startOfTodayInMadrid(now: Date = new Date()): Date {
    const [year, month, day] = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Madrid',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .format(now)
      .split('-')
      .map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }

  /**
   * "Everybody confirmed" and "everybody answered" were only ever evaluated when
   * somebody responded, so removing the last person still to answer left the quedada
   * stuck in pending and the ring open for good — with no way back, since the app no
   * longer offers those buttons to the people who already answered.
   *
   * Best-effort: the member is already out, so a failure here must not turn a
   * successful leave into a 500.
   */
  private async recomputeAfterMemberRemoval(groupId: string) {
    try {
      await this.confirmFullyConfirmedEvents(groupId);
      await this.completeFullyAnsweredPolls(groupId);
    } catch (err) {
      this.logger.error('Failed to recompute group state after removing a member', err);
    }
  }

  private async confirmFullyConfirmedEvents(groupId: string) {
    const events = await this.prisma.event.findMany({
      where: { groupId, status: 'pending', date: { gte: startOfTodayUTC() } },
      select: { id: true, title: true, attendees: { select: { status: true } } },
    });

    for (const event of events) {
      // An event nobody attends is not a confirmed one.
      if (event.attendees.length === 0) continue;
      if (!event.attendees.every((attendee) => attendee.status === 'confirmed')) continue;

      // Same conditional write + count === 1 gate as respond(): only the writer that
      // flips the row notifies, and a cancelled event is left alone.
      const { count } = await this.prisma.event.updateMany({
        where: { id: event.id, status: 'pending' },
        data: { status: 'confirmed' },
      });
      if (count !== 1) continue;

      this.notificationsService
        .sendToEventAttendees(
          event.id,
          'event_confirmed',
          { title: event.title, variant: 'all_confirmed' },
          undefined,
          { eventId: event.id, groupId },
          'confirmed',
        )
        .catch((err) => this.logger.error('Failed to send event_confirmed notification', err));
    }
  }

  private async completeFullyAnsweredPolls(groupId: string) {
    const polls = await this.prisma.availabilityPoll.findMany({
      where: { groupId, status: 'open' },
      select: { id: true, date: true, responses: { select: { userId: true, answer: true } } },
    });
    if (polls.length === 0) return;

    const members = await this.prisma.groupMember.findMany({
      where: { groupId },
      select: { userId: true },
    });
    // every() on an empty list is vacuously true: an emptied group closes nothing.
    if (members.length === 0) return;

    for (const poll of polls) {
      const yes = new Set(
        poll.responses.filter((response) => response.answer === 'yes').map((r) => r.userId),
      );
      if (!members.every((member) => yes.has(member.userId))) continue;

      const { count } = await this.prisma.availabilityPoll.updateMany({
        where: { id: poll.id, status: 'open' },
        data: { status: 'completed', completedAt: new Date() },
      });
      if (count !== 1) continue;

      // Announced once per poll, ever: a poll that reopened in silence and closes again
      // here must not re-send «el aro se cierra».
      const claimed = await this.prisma.availabilityPoll.updateMany({
        where: { id: poll.id, completedNotifiedAt: null },
        data: { completedNotifiedAt: new Date() },
      });
      if (claimed.count !== 1) continue;

      this.notificationsService
        .sendToGroup(groupId, 'poll_completed', { date: poll.date }, undefined, {
          pollId: poll.id,
          groupId,
        })
        .catch((err) => this.logger.error('poll_completed push failed', err));
    }
  }

  async getMembers(groupId: string, userId: string) {
    await this.findById(groupId, userId);

    return this.prisma.groupMember.findMany({
      where: { groupId },
      include: { user: { select: PUBLIC_USER_SELECT } },
    });
  }

  async findByInviteCode(code: string): Promise<boolean> {
    const group = await this.prisma.group.findUnique({
      where: { inviteCode: code },
      select: { id: true },
    });
    return !!group;
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
      inviteUrl: `${getFrontendUrl()}/join/${group.inviteCode}`,
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
      .sendToUser(targetUserId, 'role_changed', { role }, { groupId })
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

    // Same rule as leave(): today onward goes, the past stays.
    await this.removeMemberContributions(groupId, targetUserId);
    await this.recomputeAfterMemberRemoval(groupId);

    // The copy names the group, so there is nothing to say if the group vanished
    // between the read above and here — same shape as leave().
    if (group) {
      this.notificationsService
        .sendToUser(targetUserId, 'member_kicked', { groupName: group.name }, { groupId })
        .catch((err) => this.logger.error('Failed to send member_kicked notification', err));
    }

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

    // Send notification BEFORE delete and await it to avoid race with CASCADE
    await this.notificationsService
      .sendToGroup(groupId, 'group_deleted', { groupName: group.name }, userId, { groupId })
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

    // GET /groups/:id/weather hits Open-Meteo once per city, so an unbounded list
    // turns one cold load into a fan-out that can hold a Prisma connection for a
    // long time.
    const cityCount = await this.prisma.groupCity.count({ where: { groupId } });
    if (cityCount >= GroupsService.MAX_CITIES_PER_GROUP) {
      throw new BadRequestException(
        `A group can have at most ${GroupsService.MAX_CITIES_PER_GROUP} cities`,
      );
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
      inviteUrl: `${getFrontendUrl()}/join/${newCode}`,
    };
  }

  /**
   * Renames a group or changes its emoji (B3). Any admin may do it — unlike
   * deleteGroup, which the API reserves for the creator. Non-members get the
   * same 404 findById gives everywhere else, so this endpoint cannot be used to
   * probe which group ids exist.
   */
  async updateGroup(groupId: string, userId: string, dto: UpdateGroupDto) {
    const group = await this.findById(groupId, userId);

    const admin = await this.isAdmin(groupId, userId);
    if (!admin) {
      throw new ForbiddenException('Only admins can update the group');
    }

    const data: { name?: string; emoji?: string } = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.emoji !== undefined) data.emoji = dto.emoji;

    // Nothing to change: skip the write rather than bump updatedAt for nothing.
    if (Object.keys(data).length === 0) {
      return group;
    }

    return this.prisma.group.update({
      where: { id: groupId },
      data,
      select: GROUP_WITH_MEMBERS_SELECT,
    });
  }
}
