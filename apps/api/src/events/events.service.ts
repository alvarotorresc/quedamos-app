import { Prisma } from '@prisma/client';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { PUBLIC_USER_SELECT } from '../common/prisma/user-select';
import { GroupsService } from '../groups/groups.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { RespondEventDto } from './dto/respond-event.dto';
import { WidgetRefreshService } from '../widget-refresh/widget-refresh.service';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    private prisma: PrismaService,
    private groupsService: GroupsService,
    private notificationsService: NotificationsService,
    private widgetRefresh: WidgetRefreshService,
  ) {}

  async findAllForGroup(groupId: string, userId: string) {
    await this.groupsService.findById(groupId, userId);

    return this.prisma.event.findMany({
      where: { groupId },
      include: {
        attendees: {
          include: { user: { select: PUBLIC_USER_SELECT } },
        },
        createdBy: { select: PUBLIC_USER_SELECT },
      },
      orderBy: { date: 'asc' },
    });
  }

  async findById(groupId: string, eventId: string, userId: string) {
    await this.groupsService.findById(groupId, userId);

    const event = await this.prisma.event.findFirst({
      where: { id: eventId, groupId },
      include: {
        attendees: {
          include: { user: { select: PUBLIC_USER_SELECT } },
        },
        createdBy: { select: PUBLIC_USER_SELECT },
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    return event;
  }

  async create(
    groupId: string,
    userId: string,
    dto: CreateEventDto,
    internalStatusMap?: Record<string, 'confirmed' | 'declined'>,
    options?: { skipNewEventNotification?: boolean; skipConfirmedNotification?: boolean },
  ) {
    await this.groupsService.findById(groupId, userId);

    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const eventDate = new Date(dto.date + 'T00:00:00Z');
    if (eventDate < todayUTC) {
      throw new BadRequestException('No se pueden crear quedadas en fechas pasadas');
    }

    if (dto.time && dto.endTime && dto.endTime <= dto.time) {
      throw new BadRequestException('End time must be after start time');
    }

    const members = await this.groupsService.getMembers(groupId, userId);
    const memberIds = new Set(members.map((m) => m.userId));

    // Determine target attendees: all members or specific subset
    let targetMemberIds: string[];
    if (dto.attendeeIds && dto.attendeeIds.length > 0) {
      // Validate all attendeeIds are group members
      for (const id of dto.attendeeIds) {
        if (!memberIds.has(id)) {
          throw new BadRequestException(`User ${id} is not a member of this group`);
        }
      }
      // Always include the creator
      const targetSet = new Set(dto.attendeeIds);
      targetSet.add(userId);
      targetMemberIds = [...targetSet];
    } else {
      targetMemberIds = members.map((m) => m.userId);
    }

    const event = await this.prisma.event.create({
      data: {
        groupId,
        createdById: userId,
        title: dto.title,
        description: dto.description,
        location: dto.isOnline ? null : dto.location,
        locationLat: dto.isOnline ? null : dto.locationLat,
        locationLon: dto.isOnline ? null : dto.locationLon,
        isOnline: dto.isOnline ?? false,
        meetingUrl: dto.isOnline ? dto.meetingUrl : null,
        date: new Date(dto.date + 'T00:00:00Z'),
        time: dto.time,
        endTime: dto.endTime,
        status: 'pending',
        attendees: {
          create: targetMemberIds.map((id) => ({
            userId: id,
            status: id === userId ? 'confirmed' : (internalStatusMap?.[id] ?? 'pending'),
            ...(internalStatusMap?.[id] ? { respondedAt: new Date() } : {}),
          })),
        },
      },
      include: {
        attendees: {
          include: { user: { select: PUBLIC_USER_SELECT } },
        },
        createdBy: { select: PUBLIC_USER_SELECT },
      },
    });

    // Auto-confirm event when all attendees are already confirmed (e.g. from proposals)
    if (internalStatusMap) {
      const allConfirmed = targetMemberIds.every(
        (id) => id === userId || internalStatusMap?.[id] === 'confirmed',
      );
      if (allConfirmed) {
        await this.prisma.event.update({
          where: { id: event.id },
          data: { status: 'confirmed' },
        });
        event.status = 'confirmed';

        // Coherence with respond(): an event born confirmed also notifies event_confirmed.
        // Unless the caller already says the same thing better — converting a unanimous
        // proposal sends proposal_converted, and both landed on the same phone.
        if (!options?.skipConfirmedNotification) {
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
    }

    if (!options?.skipNewEventNotification) {
      if (dto.attendeeIds && dto.attendeeIds.length > 0) {
        this.notificationsService
          .sendToEventAttendees(
            event.id,
            'new_event',
            { actorName: event.createdBy.name, title: event.title },
            userId,
            { eventId: event.id, groupId },
          )
          .catch((err) => this.logger.error('Failed to send new_event notification', err));
      } else {
        this.notificationsService
          .sendToGroup(
            groupId,
            'new_event',
            { actorName: event.createdBy.name, title: event.title },
            userId,
            { eventId: event.id, groupId },
          )
          .catch((err) => this.logger.error('Failed to send new_event notification', err));
      }
    }

    this.widgetRefresh.notifyGroupWidgets(groupId, userId);

    return event;
  }

  async update(groupId: string, eventId: string, userId: string, dto: UpdateEventDto) {
    const event = await this.findById(groupId, eventId, userId);

    if (event.createdById !== userId) {
      throw new ForbiddenException('Only the creator can edit this event');
    }

    if (dto.date) {
      const now = new Date();
      const todayUTC = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
      );
      const eventDate = new Date(dto.date + 'T00:00:00Z');
      if (eventDate < todayUTC) {
        throw new BadRequestException('Cannot set date to the past');
      }
    }

    // `??` would treat an explicit null (clear the field) as "not sent" and validate
    // the stored value instead, rejecting perfectly valid edits.
    const finalTime = dto.time !== undefined ? dto.time : event.time;
    const finalEndTime = dto.endTime !== undefined ? dto.endTime : event.endTime;
    if (finalTime && finalEndTime && finalEndTime <= finalTime) {
      throw new BadRequestException('End time must be after start time');
    }

    // Resolve the effective isOnline state: use dto value if provided, else current DB value
    const effectiveIsOnline = dto.isOnline ?? event.isOnline;

    const data: Record<string, unknown> = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.date !== undefined) data.date = new Date(dto.date + 'T00:00:00Z');
    if (dto.time !== undefined) data.time = dto.time;
    if (dto.endTime !== undefined) data.endTime = dto.endTime;

    if (dto.isOnline !== undefined) {
      data.isOnline = dto.isOnline;
      if (dto.isOnline === true) {
        data.location = null;
        data.locationLat = null;
        data.locationLon = null;
      } else {
        data.meetingUrl = null;
      }
    }

    // Only allow location/coordinate changes when NOT online
    if (!effectiveIsOnline) {
      if (dto.location !== undefined) {
        data.location = dto.location;
        if (!dto.location) {
          data.locationLat = null;
          data.locationLon = null;
        }
      }
      if (dto.locationLat !== undefined) data.locationLat = dto.locationLat;
      if (dto.locationLon !== undefined) data.locationLon = dto.locationLon;
    }

    // Only allow meetingUrl changes when online (and don't override the null set above)
    if (dto.meetingUrl !== undefined && effectiveIsOnline && data.meetingUrl === undefined) {
      data.meetingUrl = dto.meetingUrl;
    }

    const updated = await this.prisma.event.update({
      where: { id: eventId },
      data,
      include: {
        attendees: { include: { user: { select: PUBLIC_USER_SELECT } } },
        createdBy: { select: PUBLIC_USER_SELECT },
      },
    });

    this.notificationsService
      .sendToEventAttendees(eventId, 'event_updated', { title: updated.title }, userId, {
        eventId,
        groupId,
      })
      .catch((err) => this.logger.error('Failed to send event_updated notification', err));

    this.widgetRefresh.notifyGroupWidgets(groupId, userId);

    return updated;
  }

  async delete(groupId: string, eventId: string, userId: string) {
    const event = await this.findById(groupId, eventId, userId);

    if (event.createdById !== userId) {
      throw new ForbiddenException('Only the creator can delete this event');
    }

    // Send notification before delete and await it to avoid a race with the CASCADE:
    // the push reads event_attendees, which the delete takes away. Same shape as
    // deleteGroup — the catch keeps a failing push from blocking the deletion.
    await this.notificationsService
      .sendToEventAttendees(eventId, 'event_deleted', { title: event.title }, userId, {
        eventId,
        groupId,
      })
      .catch((err) => this.logger.error('Failed to send event_deleted notification', err));

    await this.prisma.event.delete({ where: { id: eventId } });

    this.widgetRefresh.notifyGroupWidgets(groupId, userId);

    return { success: true };
  }

  async cancel(groupId: string, eventId: string, userId: string) {
    const event = await this.findById(groupId, eventId, userId);

    if (event.createdById !== userId) {
      throw new ForbiddenException('Only the creator can cancel this event');
    }

    const updated = await this.prisma.event.update({
      where: { id: eventId },
      data: { status: 'cancelled' },
      include: {
        attendees: { include: { user: { select: PUBLIC_USER_SELECT } } },
        createdBy: { select: PUBLIC_USER_SELECT },
      },
    });

    this.notificationsService
      .sendToEventAttendees(eventId, 'event_cancelled', { title: event.title }, userId, {
        eventId,
        groupId,
      })
      .catch((err) => this.logger.error('Failed to send event_cancelled notification', err));

    // A cancelled plan drops out of the widget: widget-summary.service.ts filters
    // `status: { not: 'cancelled' }`.
    this.widgetRefresh.notifyGroupWidgets(groupId, userId);

    return updated;
  }

  async confirm(groupId: string, eventId: string, userId: string) {
    const event = await this.findById(groupId, eventId, userId);

    if (event.createdById !== userId) {
      throw new ForbiddenException('Only the creator can confirm this event');
    }

    if (event.status !== 'pending') {
      throw new BadRequestException('Only pending events can be confirmed');
    }

    const updated = await this.prisma.event.update({
      where: { id: eventId },
      data: { status: 'confirmed' },
      include: {
        attendees: { include: { user: { select: PUBLIC_USER_SELECT } } },
        createdBy: { select: PUBLIC_USER_SELECT },
      },
    });

    this.notificationsService
      .sendToEventAttendees(
        eventId,
        'event_confirmed',
        { title: event.title, variant: 'manual' },
        userId,
        { eventId, groupId },
      )
      .catch((err) => this.logger.error('Failed to send event_confirmed notification', err));

    this.widgetRefresh.notifyGroupWidgets(groupId, userId);

    return updated;
  }

  async respond(groupId: string, eventId: string, userId: string, dto: RespondEventDto) {
    const event = await this.findById(groupId, eventId, userId);

    if (event.status === 'cancelled') {
      throw new BadRequestException('Cannot respond to a cancelled event');
    }

    const attendee = await this.prisma.eventAttendee.findUnique({
      where: {
        eventId_userId: { eventId, userId },
      },
    });

    if (!attendee) {
      throw new NotFoundException('Not invited to this event');
    }

    // Transaction to atomically update attendee + check/update event status.
    // The "all confirmed" decision is taken INSIDE the transaction by comparing
    // the pre-update status with the post-update result, so concurrent responds
    // or re-confirmations on an already confirmed event never re-send the
    // event_confirmed notification.
    // Serializable so two last-minute confirmations cannot each miss the other's
    // row and leave the event pending with nobody notified; Postgres aborts one
    // of them with P2034 and we simply run it again.
    const { justReachedAllConfirmed, eventTitle } = await this.withSerializationRetry(async () =>
      this.prisma.$transaction(
        async (tx) => {
          const preEvent = await tx.event.findUnique({
            where: { id: eventId },
            select: { status: true, title: true },
          });

          // The guard above ran on a read taken OUTSIDE this transaction. cancel() is a
          // plain update that can commit in between (the creator cancels while the last
          // attendee confirms), so the cancelled check has to be repeated here.
          if (preEvent?.status === 'cancelled') {
            throw new BadRequestException('Cannot respond to a cancelled event');
          }

          await tx.eventAttendee.update({
            where: { eventId_userId: { eventId, userId } },
            data: {
              status: dto.status,
              respondedAt: new Date(),
            },
          });

          const allAttendees = await tx.eventAttendee.findMany({
            where: { eventId },
          });

          const allConfirmed = allAttendees.every((a) => a.status === 'confirmed');
          const anyDeclined = allAttendees.some((a) => a.status === 'declined');

          // Conditional write: belt and braces over the guard above, so a cancel that
          // slips in cannot be turned into a confirmation — and `count` gates the push.
          let justConfirmed = false;
          if (allConfirmed) {
            const { count } = await tx.event.updateMany({
              where: { id: eventId, status: { not: 'cancelled' } },
              data: { status: 'confirmed' },
            });
            justConfirmed = count === 1;
          } else if (anyDeclined) {
            await tx.event.update({
              where: { id: eventId },
              data: { status: 'pending' },
            });
          }

          return {
            justReachedAllConfirmed: justConfirmed && preEvent?.status !== 'confirmed',
            eventTitle: preEvent?.title ?? event.title,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );

    // Notifications outside transaction (fire-and-forget). The attendee whose answer
    // completed the round already knows: they are looking at the screen that did it.
    if (dto.status === 'confirmed' && justReachedAllConfirmed) {
      this.notificationsService
        .sendToEventAttendees(
          eventId,
          'event_confirmed',
          { title: eventTitle, variant: 'all_confirmed' },
          userId,
          { eventId, groupId },
          'confirmed',
        )
        .catch((err) => this.logger.error('Failed to send event_confirmed notification', err));
    }

    if (dto.status === 'declined') {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        this.notificationsService
          .sendToEventAttendees(
            eventId,
            'event_declined',
            { actorName: user.name, title: eventTitle },
            userId,
            { eventId, groupId },
            'confirmed',
          )
          .catch((err) => this.logger.error('Failed to send event_declined notification', err));
      }
    }

    return this.findById(groupId, eventId, userId);
  }

  /** Runs `work` up to three times while Postgres reports a serialization failure (P2034). */
  private async withSerializationRetry<T>(work: () => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await work();
      } catch (error) {
        lastError = error;
        if ((error as { code?: string } | null)?.code !== 'P2034') throw error;
      }
    }
    throw lastError;
  }
}
