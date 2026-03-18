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

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    private prisma: PrismaService,
    private groupsService: GroupsService,
    private notificationsService: NotificationsService,
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

  async create(groupId: string, userId: string, dto: CreateEventDto) {
    await this.groupsService.findById(groupId, userId);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eventDate = new Date(dto.date + 'T00:00:00');
    if (eventDate < today) {
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
        location: dto.location,
        locationLat: dto.locationLat,
        locationLon: dto.locationLon,
        date: new Date(dto.date),
        time: dto.time,
        endTime: dto.endTime,
        status: 'pending',
        attendees: {
          create: targetMemberIds.map((id) => ({
            userId: id,
            status: id === userId ? 'confirmed' : (dto.attendeeStatusMap?.[id] ?? 'pending'),
            ...(dto.attendeeStatusMap?.[id] ? { respondedAt: new Date() } : {}),
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
    if (dto.attendeeStatusMap) {
      const allConfirmed = targetMemberIds.every(
        (id) => id === userId || dto.attendeeStatusMap?.[id] === 'confirmed',
      );
      if (allConfirmed) {
        await this.prisma.event.update({
          where: { id: event.id },
          data: { status: 'confirmed' },
        });
        event.status = 'confirmed';
      }
    }

    if (dto.attendeeIds && dto.attendeeIds.length > 0) {
      this.notificationsService
        .sendToEventAttendees(
          event.id,
          'Nueva quedada',
          `${event.createdBy.name} ha creado "${event.title}"`,
          userId,
          { type: 'new_event', eventId: event.id, groupId },
          'new_event',
        )
        .catch((err) => this.logger.error('Failed to send new_event notification', err));
    } else {
      this.notificationsService
        .sendToGroup(
          groupId,
          'Nueva quedada',
          `${event.createdBy.name} ha creado "${event.title}"`,
          userId,
          { type: 'new_event', eventId: event.id, groupId },
          'new_event',
        )
        .catch((err) => this.logger.error('Failed to send new_event notification', err));
    }

    return event;
  }

  async update(groupId: string, eventId: string, userId: string, dto: UpdateEventDto) {
    const event = await this.findById(groupId, eventId, userId);

    if (event.createdById !== userId) {
      throw new ForbiddenException('Only the creator can edit this event');
    }

    if (dto.date) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const eventDate = new Date(dto.date + 'T00:00:00');
      if (eventDate < today) {
        throw new BadRequestException('Cannot set date to the past');
      }
    }

    const finalTime = dto.time ?? event.time;
    const finalEndTime = dto.endTime ?? event.endTime;
    if (finalTime && finalEndTime && finalEndTime <= finalTime) {
      throw new BadRequestException('End time must be after start time');
    }

    const data: Record<string, unknown> = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.location !== undefined) data.location = dto.location;
    if (dto.locationLat !== undefined) data.locationLat = dto.locationLat;
    if (dto.locationLon !== undefined) data.locationLon = dto.locationLon;
    if (dto.date !== undefined) data.date = new Date(dto.date);
    if (dto.time !== undefined) data.time = dto.time;
    if (dto.endTime !== undefined) data.endTime = dto.endTime;

    const updated = await this.prisma.event.update({
      where: { id: eventId },
      data,
      include: {
        attendees: { include: { user: { select: PUBLIC_USER_SELECT } } },
        createdBy: { select: PUBLIC_USER_SELECT },
      },
    });

    this.notificationsService
      .sendToEventAttendees(
        eventId,
        'Quedada actualizada',
        `"${updated.title}" ha sido editada`,
        userId,
        { type: 'event_updated', eventId, groupId },
        'event_updated',
        'confirmed',
      )
      .catch((err) => this.logger.error('Failed to send event_updated notification', err));

    return updated;
  }

  async delete(groupId: string, eventId: string, userId: string) {
    const event = await this.findById(groupId, eventId, userId);

    if (event.createdById !== userId) {
      throw new ForbiddenException('Only the creator can delete this event');
    }

    await this.prisma.event.delete({ where: { id: eventId } });

    this.notificationsService
      .sendToGroup(
        groupId,
        'Quedada eliminada',
        `"${event.title}" ha sido eliminada`,
        userId,
        { type: 'event_deleted', eventId, groupId },
        'event_deleted',
      )
      .catch((err) => this.logger.error('Failed to send event_deleted notification', err));

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
      .sendToEventAttendees(
        eventId,
        'Quedada cancelada',
        `"${event.title}" ha sido cancelada`,
        userId,
        { type: 'event_cancelled', eventId, groupId },
        'event_cancelled',
      )
      .catch((err) => this.logger.error('Failed to send event_cancelled notification', err));

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

    // Transaction to atomically update attendee + check/update event status
    await this.prisma.$transaction(async (tx) => {
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

      if (allConfirmed) {
        await tx.event.update({
          where: { id: eventId },
          data: { status: 'confirmed' },
        });
      } else if (anyDeclined) {
        await tx.event.update({
          where: { id: eventId },
          data: { status: 'pending' },
        });
      }
    });

    // Notifications outside transaction (fire-and-forget)
    if (dto.status === 'confirmed') {
      const allAttendees = await this.prisma.eventAttendee.findMany({ where: { eventId } });
      const allConfirmed = allAttendees.every((a) => a.status === 'confirmed');
      if (allConfirmed) {
        const event = await this.prisma.event.findUnique({ where: { id: eventId } });
        if (event) {
          this.notificationsService
            .sendToEventAttendees(
              eventId,
              'Quedada confirmada',
              `Todos han confirmado "${event.title}"`,
              undefined,
              { type: 'event_confirmed', eventId, groupId },
              'event_confirmed',
              'confirmed',
            )
            .catch((err) => this.logger.error('Failed to send event_confirmed notification', err));
        }
      }
    }

    if (dto.status === 'declined') {
      const [user, declinedEvent] = await Promise.all([
        this.prisma.user.findUnique({ where: { id: userId } }),
        this.prisma.event.findUnique({ where: { id: eventId } }),
      ]);
      if (user && declinedEvent) {
        this.notificationsService
          .sendToEventAttendees(
            eventId,
            'Asistencia rechazada',
            `${user.name} ha rechazado "${declinedEvent.title}"`,
            userId,
            { type: 'event_declined', eventId, groupId },
            'event_declined',
            'confirmed',
          )
          .catch((err) => this.logger.error('Failed to send event_declined notification', err));
      }
    }

    return this.findById(groupId, eventId, userId);
  }
}
