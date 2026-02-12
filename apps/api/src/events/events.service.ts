import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { GroupsService } from '../groups/groups.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateEventDto } from './dto/create-event.dto';
import { RespondEventDto } from './dto/respond-event.dto';

@Injectable()
export class EventsService {
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
          include: { user: true },
        },
        createdBy: true,
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
          include: { user: true },
        },
        createdBy: true,
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    return event;
  }

  async create(groupId: string, userId: string, dto: CreateEventDto) {
    await this.groupsService.findById(groupId, userId);

    const members = await this.groupsService.getMembers(groupId, userId);

    const event = await this.prisma.event.create({
      data: {
        groupId,
        createdById: userId,
        title: dto.title,
        description: dto.description,
        location: dto.location,
        date: new Date(dto.date),
        time: dto.time,
        status: 'pending',
        attendees: {
          create: members.map((m) => ({
            userId: m.userId,
            status: m.userId === userId ? 'confirmed' : 'pending',
          })),
        },
      },
      include: {
        attendees: {
          include: { user: true },
        },
        createdBy: true,
      },
    });

    // Fire-and-forget push notification
    this.notificationsService
      .sendToGroup(
        groupId,
        'Nueva quedada',
        `${event.createdBy.name} ha creado "${event.title}"`,
        userId,
        { type: 'new_event', eventId: event.id, groupId },
      )
      .catch(() => {});

    return event;
  }

  async respond(
    groupId: string,
    eventId: string,
    userId: string,
    dto: RespondEventDto,
  ) {
    await this.findById(groupId, eventId, userId);

    const attendee = await this.prisma.eventAttendee.findUnique({
      where: {
        eventId_userId: { eventId, userId },
      },
    });

    if (!attendee) {
      throw new NotFoundException('Not invited to this event');
    }

    await this.prisma.eventAttendee.update({
      where: { eventId_userId: { eventId, userId } },
      data: {
        status: dto.status,
        respondedAt: new Date(),
      },
    });

    const allAttendees = await this.prisma.eventAttendee.findMany({
      where: { eventId },
    });

    const allConfirmed = allAttendees.every((a) => a.status === 'confirmed');
    const anyDeclined = allAttendees.some((a) => a.status === 'declined');

    if (allConfirmed) {
      await this.prisma.event.update({
        where: { id: eventId },
        data: { status: 'confirmed' },
      });

      // Fire-and-forget push notification
      const event = await this.prisma.event.findUnique({
        where: { id: eventId },
      });
      if (event) {
        this.notificationsService
          .sendToGroup(
            groupId,
            'Quedada confirmada',
            `Todos han confirmado "${event.title}"`,
            undefined,
            { type: 'event_confirmed', eventId, groupId },
          )
          .catch(() => {});
      }
    } else if (anyDeclined) {
      await this.prisma.event.update({
        where: { id: eventId },
        data: { status: 'pending' },
      });
    }

    return this.findById(groupId, eventId, userId);
  }
}
