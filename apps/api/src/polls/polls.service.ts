import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { PUBLIC_USER_SELECT } from '../common/prisma/user-select';
import { GroupsService } from '../groups/groups.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AvailabilityService } from '../availability/availability.service';
import { CreatePollDto } from './dto/create-poll.dto';
import { RespondPollDto } from './dto/respond-poll.dto';

/**
 * Timezone used for the question copy and for the daily anti-spam window.
 * v0.1 hardcodes the group timezone to Europe/Madrid, like the reminders.
 */
const DEFAULT_TIMEZONE = 'Europe/Madrid';

@Injectable()
export class PollsService {
  private readonly logger = new Logger(PollsService.name);

  constructor(
    private prisma: PrismaService,
    private groupsService: GroupsService,
    private notifications: NotificationsService,
    private availabilityService: AvailabilityService,
  ) {}

  private static readonly SLOT_LABEL: Record<string, string> = {
    Mañana: 'por la mañana',
    Tarde: 'por la tarde',
    Noche: 'por la noche',
  };

  private weekday(date: Date): string {
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      timeZone: DEFAULT_TIMEZONE,
    });
  }

  private questionTitle(date: Date, slot: string | null): string {
    const weekday = this.weekday(date);
    return slot
      ? `¿Puedes el ${weekday} ${PollsService.SLOT_LABEL[slot]}?`
      : `¿Puedes el ${weekday}?`;
  }

  /**
   * Midnight in Europe/Madrid as an absolute instant. Computed from the
   * formatted wall clock so it does not depend on the server timezone.
   */
  private startOfDay(now: Date): Date {
    const [, time] = new Intl.DateTimeFormat('sv-SE', {
      timeZone: DEFAULT_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
      .format(now)
      .split(' ');
    const [hours, minutes, seconds] = time.split(':').map(Number);
    const elapsedMs = ((hours * 60 + minutes) * 60 + seconds) * 1000 + now.getMilliseconds();
    return new Date(now.getTime() - elapsedMs);
  }

  async create(groupId: string, userId: string, dto: CreatePollDto) {
    const group = await this.groupsService.findById(groupId, userId);

    const existing = await this.prisma.availabilityPoll.findFirst({
      where: {
        groupId,
        date: new Date(dto.date),
        slot: dto.slot ?? null,
        status: 'open',
      },
    });
    if (existing) throw new ConflictException('An open poll already exists for this day');

    const poll = await this.prisma.availabilityPoll.create({
      data: {
        groupId,
        createdById: userId,
        date: new Date(dto.date),
        slot: dto.slot ?? null,
        responses: { create: { userId, answer: 'yes' } },
      },
      include: { createdBy: { select: PUBLIC_USER_SELECT } },
    });

    // Asking already answers for you: the ring lights up without a second tap. Merge, not
    // replace — never degrade availability the asker already marked (I1).
    await this.availabilityService.mergeFromPoll(groupId, userId, dto.date, dto.slot ?? null);

    // Anti-spam rule (spec §3): at most ONE poll push per group per day.
    // The poll is created either way — it just stays silent in the deck.
    const createdToday = await this.prisma.availabilityPoll.count({
      where: { groupId, createdAt: { gte: this.startOfDay(new Date()) } },
    });
    if (createdToday <= 1) {
      const title = this.questionTitle(poll.date, poll.slot);
      this.notifications
        .sendToGroup(
          groupId,
          title,
          `Pregunta ${poll.createdBy.name} · ${group.name}`,
          userId,
          { type: 'new_poll', pollId: poll.id, groupId, date: dto.date },
          'new_poll',
        )
        .catch((err) => this.logger.error('new_poll push failed', err));
    }

    return poll;
  }

  async findAllForGroup(groupId: string, userId: string) {
    await this.groupsService.findById(groupId, userId);

    return this.prisma.availabilityPoll.findMany({
      where: { groupId, status: { in: ['open', 'completed'] } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        createdBy: { select: PUBLIC_USER_SELECT },
        responses: { include: { user: { select: PUBLIC_USER_SELECT } } },
      },
    });
  }

  async respond(groupId: string, pollId: string, userId: string, dto: RespondPollDto) {
    await this.groupsService.findById(groupId, userId);

    const poll = await this.prisma.availabilityPoll.findFirst({
      where: { id: pollId, groupId },
    });
    if (!poll) throw new NotFoundException('Poll not found');
    if (poll.status === 'closed') throw new ForbiddenException('Poll is closed');

    await this.prisma.pollResponse.upsert({
      where: { pollId_userId: { pollId, userId } },
      update: { answer: dto.answer, respondedAt: new Date() },
      create: { pollId, userId, answer: dto.answer },
    });

    if (dto.answer === 'yes') {
      const dateKey = poll.date.toISOString().slice(0, 10);
      await this.availabilityService.mergeFromPoll(groupId, userId, dateKey, poll.slot);
    }

    const [members, responses] = await Promise.all([
      this.groupsService.getMembers(groupId, userId),
      this.prisma.pollResponse.findMany({ where: { pollId } }),
    ]);
    const yes = new Set(responses.filter((r) => r.answer === 'yes').map((r) => r.userId));
    const allYes = members.every((m) => yes.has(m.userId));

    if (allYes && poll.status === 'open') {
      // Guard against the double-push race: only the writer that flips the row notifies.
      const { count } = await this.prisma.availabilityPoll.updateMany({
        where: { id: pollId, status: 'open' },
        data: { status: 'completed', completedAt: new Date() },
      });
      if (count === 1) {
        this.notifications
          .sendToGroup(
            groupId,
            'El aro se cierra',
            `Podéis todos el ${this.weekday(poll.date)}`,
            undefined,
            { type: 'poll_completed', pollId, groupId },
            'poll_completed',
          )
          .catch((err) => this.logger.error('poll_completed push failed', err));
      }
    }

    return this.findOne(groupId, pollId, userId);
  }

  async close(groupId: string, pollId: string, userId: string) {
    await this.groupsService.findById(groupId, userId);

    const poll = await this.prisma.availabilityPoll.findFirst({
      where: { id: pollId, groupId },
    });
    if (!poll) throw new NotFoundException('Poll not found');
    if (poll.createdById !== userId) {
      throw new ForbiddenException('Only the creator can close a poll');
    }

    return this.prisma.availabilityPoll.update({
      where: { id: pollId },
      data: { status: 'closed' },
    });
  }

  private async findOne(groupId: string, pollId: string, userId: string) {
    await this.groupsService.findById(groupId, userId);

    const poll = await this.prisma.availabilityPoll.findFirst({
      where: { id: pollId, groupId },
      include: {
        createdBy: { select: PUBLIC_USER_SELECT },
        responses: { include: { user: { select: PUBLIC_USER_SELECT } } },
      },
    });
    if (!poll) throw new NotFoundException('Poll not found');
    return poll;
  }
}
