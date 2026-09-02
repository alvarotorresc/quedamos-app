import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventsService } from './events.service';
import { GroupsService } from '../groups/groups.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  createMockPrisma,
  createMockNotificationsService,
  createTestUser,
  createTestGroup,
  createTestEvent,
} from '../common/test-utils';

describe('EventsService', () => {
  let service: EventsService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let groupsService: jest.Mocked<Partial<GroupsService>>;
  let notifications: ReturnType<typeof createMockNotificationsService>;

  beforeEach(() => {
    prisma = createMockPrisma();
    groupsService = {
      findById: jest.fn().mockResolvedValue(createTestGroup()),
      getMembers: jest.fn().mockResolvedValue([
        { userId: 'user-1', user: createTestUser() },
        { userId: 'user-2', user: createTestUser({ id: 'user-2' }) },
      ]),
    };
    notifications = createMockNotificationsService();
    service = new EventsService(
      prisma as unknown as PrismaService,
      groupsService as unknown as GroupsService,
      notifications as unknown as NotificationsService,
    );
  });

  describe('findAllForGroup', () => {
    it('should return events for group', async () => {
      const events = [createTestEvent(), createTestEvent({ id: 'event-2' })];
      prisma.event.findMany.mockResolvedValue(events);

      const result = await service.findAllForGroup('group-1', 'user-1');

      expect(result).toHaveLength(2);
      expect(groupsService.findById).toHaveBeenCalledWith('group-1', 'user-1');
    });
  });

  describe('findById', () => {
    it('should return event by id', async () => {
      const event = createTestEvent();
      prisma.event.findFirst.mockResolvedValue(event);

      const result = await service.findById('group-1', 'event-1', 'user-1');

      expect(result).toEqual(event);
    });

    it('should throw NotFoundException when event not found', async () => {
      prisma.event.findFirst.mockResolvedValue(null);

      await expect(service.findById('group-1', 'nonexistent', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create event and auto-confirm creator', async () => {
      const event = {
        ...createTestEvent(),
        createdBy: createTestUser(),
        attendees: [
          { userId: 'user-1', status: 'confirmed' },
          { userId: 'user-2', status: 'pending' },
        ],
      };
      prisma.event.create.mockResolvedValue(event);

      const result = await service.create('group-1', 'user-1', {
        title: 'Test Event',
        date: '2026-12-01',
        time: '18:00',
      });

      expect(result).toBeDefined();
      expect(prisma.event.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            attendees: {
              create: expect.arrayContaining([
                expect.objectContaining({ userId: 'user-1', status: 'confirmed' }),
                expect.objectContaining({ userId: 'user-2', status: 'pending' }),
              ]),
            },
          }),
        }),
      );
    });

    it('should store date as UTC midnight', async () => {
      const event = {
        ...createTestEvent(),
        createdBy: createTestUser(),
        attendees: [],
      };
      prisma.event.create.mockResolvedValue(event);

      await service.create('group-1', 'user-1', {
        title: 'UTC Test',
        date: '2026-12-01',
      });

      const createCall = prisma.event.create.mock.calls[0][0];
      const storedDate = createCall.data.date as Date;
      expect(storedDate.toISOString()).toBe('2026-12-01T00:00:00.000Z');
    });

    it('should send push notification on create', async () => {
      const event = {
        ...createTestEvent(),
        createdBy: createTestUser(),
        attendees: [],
      };
      prisma.event.create.mockResolvedValue(event);

      await service.create('group-1', 'user-1', {
        title: 'Test Event',
        date: '2026-12-01',
      });

      expect(notifications.sendToGroup).toHaveBeenCalledWith(
        'group-1',
        'Nueva quedada',
        expect.stringContaining('Test Event'),
        'user-1',
        expect.objectContaining({ type: 'new_event' }),
        'new_event',
      );
    });

    it('should use sendToEventAttendees when attendeeIds are provided', async () => {
      const event = {
        ...createTestEvent(),
        createdBy: createTestUser(),
        attendees: [
          { userId: 'user-1', status: 'confirmed' },
          { userId: 'user-2', status: 'pending' },
        ],
      };
      prisma.event.create.mockResolvedValue(event);

      await service.create('group-1', 'user-1', {
        title: 'Selective Event',
        date: '2026-12-01',
        attendeeIds: ['user-2'],
      });

      expect(notifications.sendToEventAttendees).toHaveBeenCalledWith(
        'event-1',
        'Nueva quedada',
        expect.stringContaining('Test Event'),
        'user-1',
        expect.objectContaining({ type: 'new_event' }),
        'new_event',
      );
      expect(notifications.sendToGroup).not.toHaveBeenCalled();
    });

    it('should reject events in the past', async () => {
      await expect(
        service.create('group-1', 'user-1', {
          title: 'Old Event',
          date: '2020-01-01',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create event with endTime', async () => {
      const event = {
        ...createTestEvent(),
        createdBy: createTestUser(),
        attendees: [],
      };
      prisma.event.create.mockResolvedValue(event);

      await service.create('group-1', 'user-1', {
        title: 'Test Event',
        date: '2026-12-01',
        time: '16:00',
        endTime: '21:00',
      });

      expect(prisma.event.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            time: '16:00',
            endTime: '21:00',
          }),
        }),
      );
    });

    it('should reject when endTime is before time', async () => {
      await expect(
        service.create('group-1', 'user-1', {
          title: 'Test Event',
          date: '2026-12-01',
          time: '18:00',
          endTime: '16:00',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should use internalStatusMap for pre-set attendee statuses', async () => {
      const event = {
        ...createTestEvent(),
        createdBy: createTestUser(),
        attendees: [
          { userId: 'user-1', status: 'confirmed' },
          { userId: 'user-2', status: 'declined' },
        ],
      };
      prisma.event.create.mockResolvedValue(event);

      await service.create(
        'group-1',
        'user-1',
        { title: 'From Proposal', date: '2026-12-01' },
        { 'user-2': 'declined' },
      );

      expect(prisma.event.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            attendees: {
              create: expect.arrayContaining([
                expect.objectContaining({ userId: 'user-1', status: 'confirmed' }),
                expect.objectContaining({ userId: 'user-2', status: 'declined' }),
              ]),
            },
          }),
        }),
      );
    });

    it('should auto-confirm event when all attendees are pre-confirmed', async () => {
      const event = {
        ...createTestEvent(),
        createdBy: createTestUser(),
        attendees: [
          { userId: 'user-1', status: 'confirmed' },
          { userId: 'user-2', status: 'confirmed' },
        ],
      };
      prisma.event.create.mockResolvedValue(event);
      prisma.event.update.mockResolvedValue({ ...event, status: 'confirmed' });

      const result = await service.create(
        'group-1',
        'user-1',
        { title: 'All Confirmed', date: '2026-12-01' },
        { 'user-2': 'confirmed' },
      );

      expect(prisma.event.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'confirmed' },
        }),
      );
      expect(result.status).toBe('confirmed');
    });

    it('should send event_confirmed when event is auto-confirmed on create', async () => {
      const event = {
        ...createTestEvent(),
        createdBy: createTestUser(),
        attendees: [
          { userId: 'user-1', status: 'confirmed' },
          { userId: 'user-2', status: 'confirmed' },
        ],
      };
      prisma.event.create.mockResolvedValue(event);
      prisma.event.update.mockResolvedValue({ ...event, status: 'confirmed' });

      await service.create(
        'group-1',
        'user-1',
        { title: 'All Confirmed', date: '2026-12-01' },
        { 'user-2': 'confirmed' },
      );

      expect(notifications.sendToEventAttendees).toHaveBeenCalledWith(
        'event-1',
        'Quedada confirmada',
        expect.stringContaining('Test Event'),
        undefined,
        expect.objectContaining({ type: 'event_confirmed' }),
        'event_confirmed',
        'confirmed',
      );
    });

    it('should not send event_confirmed when auto-confirm does not apply', async () => {
      const event = {
        ...createTestEvent(),
        createdBy: createTestUser(),
        attendees: [
          { userId: 'user-1', status: 'confirmed' },
          { userId: 'user-2', status: 'declined' },
        ],
      };
      prisma.event.create.mockResolvedValue(event);

      await service.create(
        'group-1',
        'user-1',
        { title: 'Partial', date: '2026-12-01' },
        { 'user-2': 'declined' },
      );

      expect(notifications.sendToEventAttendees).not.toHaveBeenCalled();
    });

    it('should not auto-confirm when some attendees are not confirmed', async () => {
      const event = {
        ...createTestEvent(),
        createdBy: createTestUser(),
        attendees: [
          { userId: 'user-1', status: 'confirmed' },
          { userId: 'user-2', status: 'declined' },
        ],
      };
      prisma.event.create.mockResolvedValue(event);

      await service.create(
        'group-1',
        'user-1',
        { title: 'Partial', date: '2026-12-01' },
        { 'user-2': 'declined' },
      );

      expect(prisma.event.update).not.toHaveBeenCalled();
    });

    it('should pass through location coordinates on create', async () => {
      const event = {
        ...createTestEvent(),
        createdBy: createTestUser(),
        attendees: [],
      };
      prisma.event.create.mockResolvedValue(event);

      await service.create('group-1', 'user-1', {
        title: 'Test Event',
        date: '2026-12-01',
        location: 'Retiro Park',
        locationLat: 40.4153,
        locationLon: -3.6845,
      });

      expect(prisma.event.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            locationLat: 40.4153,
            locationLon: -3.6845,
          }),
        }),
      );
    });

    it('should allow event without endTime', async () => {
      const event = {
        ...createTestEvent(),
        createdBy: createTestUser(),
        attendees: [],
      };
      prisma.event.create.mockResolvedValue(event);

      const result = await service.create('group-1', 'user-1', {
        title: 'Test Event',
        date: '2026-12-01',
        time: '18:00',
      });

      expect(result).toBeDefined();
    });

    it('should not send new_event notification when skipNewEventNotification is set', async () => {
      const event = {
        ...createTestEvent(),
        createdBy: createTestUser(),
        attendees: [],
      };
      prisma.event.create.mockResolvedValue(event);

      await service.create(
        'group-1',
        'user-1',
        { title: 'From Proposal', date: '2026-12-01' },
        undefined,
        { skipNewEventNotification: true },
      );

      expect(notifications.sendToGroup).not.toHaveBeenCalled();
      expect(notifications.sendToEventAttendees).not.toHaveBeenCalled();
    });

    it('should still send event_confirmed when converting a proposal with skipNewEventNotification', async () => {
      const event = {
        ...createTestEvent(),
        createdBy: createTestUser(),
        attendees: [
          { userId: 'user-1', status: 'confirmed' },
          { userId: 'user-2', status: 'confirmed' },
        ],
      };
      prisma.event.create.mockResolvedValue(event);
      prisma.event.update.mockResolvedValue({ ...event, status: 'confirmed' });

      await service.create(
        'group-1',
        'user-1',
        { title: 'From Proposal', date: '2026-12-01' },
        { 'user-2': 'confirmed' },
        { skipNewEventNotification: true },
      );

      expect(notifications.sendToGroup).not.toHaveBeenCalled();
      expect(notifications.sendToEventAttendees).toHaveBeenCalledWith(
        'event-1',
        'Quedada confirmada',
        expect.stringContaining('Test Event'),
        undefined,
        expect.objectContaining({ type: 'event_confirmed' }),
        'event_confirmed',
        'confirmed',
      );
      expect(notifications.sendToEventAttendees).toHaveBeenCalledTimes(1);
    });
  });

  describe('respond', () => {
    beforeEach(() => {
      prisma.event.findFirst.mockResolvedValue(createTestEvent());
    });

    it('should reject respond to cancelled event', async () => {
      prisma.event.findFirst.mockResolvedValue({
        ...createTestEvent({ status: 'cancelled' }),
        attendees: [],
        createdBy: createTestUser(),
      });

      await expect(
        service.respond('group-1', 'event-1', 'user-1', { status: 'confirmed' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update attendee status to confirmed', async () => {
      prisma.eventAttendee.findUnique.mockResolvedValue({
        eventId: 'event-1',
        userId: 'user-1',
        status: 'pending',
      });
      prisma.eventAttendee.update.mockResolvedValue({});
      prisma.eventAttendee.findMany.mockResolvedValue([
        { userId: 'user-1', status: 'confirmed' },
        { userId: 'user-2', status: 'pending' },
      ]);
      prisma.event.findFirst.mockResolvedValue({
        ...createTestEvent(),
        attendees: [{ userId: 'user-1', status: 'confirmed', user: createTestUser() }],
        createdBy: createTestUser(),
      });

      const result = await service.respond('group-1', 'event-1', 'user-1', { status: 'confirmed' });

      expect(result).toBeDefined();
      expect(prisma.eventAttendee.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'confirmed' }),
        }),
      );
    });

    it('should use transaction for atomic attendee update and status check', async () => {
      prisma.eventAttendee.findUnique.mockResolvedValue({
        eventId: 'event-1',
        userId: 'user-1',
        status: 'pending',
      });
      prisma.eventAttendee.update.mockResolvedValue({});
      prisma.eventAttendee.findMany.mockResolvedValue([
        { userId: 'user-1', status: 'confirmed' },
        { userId: 'user-2', status: 'pending' },
      ]);
      prisma.event.findFirst.mockResolvedValue({
        ...createTestEvent(),
        attendees: [],
        createdBy: createTestUser(),
      });

      await service.respond('group-1', 'event-1', 'user-1', { status: 'confirmed' });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('runs the respond transaction at serializable isolation and retries once on a serialization failure', async () => {
      prisma.eventAttendee.findUnique.mockResolvedValue({
        eventId: 'event-1',
        userId: 'user-1',
        status: 'pending',
      });
      prisma.eventAttendee.update.mockResolvedValue({});
      prisma.eventAttendee.findMany.mockResolvedValue([
        { userId: 'user-1', status: 'confirmed' },
        { userId: 'user-2', status: 'pending' },
      ]);
      prisma.event.findFirst.mockResolvedValue({
        ...createTestEvent(),
        attendees: [],
        createdBy: createTestUser(),
      });
      // Primer intento: Postgres aborta por serialización (P2034); el segundo entra.
      prisma.$transaction.mockRejectedValueOnce(
        Object.assign(new Error('serialization failure'), { code: 'P2034' }),
      );

      await service.respond('group-1', 'event-1', 'user-1', { status: 'confirmed' });

      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
      expect(prisma.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({ isolationLevel: 'Serializable' }),
      );
    });

    it('gives up after three serialization failures', async () => {
      prisma.eventAttendee.findUnique.mockResolvedValue({
        eventId: 'event-1',
        userId: 'user-1',
        status: 'pending',
      });
      prisma.event.findFirst.mockResolvedValue({
        ...createTestEvent(),
        attendees: [],
        createdBy: createTestUser(),
      });
      const failure = Object.assign(new Error('serialization failure'), { code: 'P2034' });
      prisma.$transaction
        .mockRejectedValueOnce(failure)
        .mockRejectedValueOnce(failure)
        .mockRejectedValueOnce(failure);

      await expect(
        service.respond('group-1', 'event-1', 'user-1', { status: 'confirmed' }),
      ).rejects.toThrow('serialization failure');
      expect(prisma.$transaction).toHaveBeenCalledTimes(3);
    });

    it('should throw when not invited', async () => {
      prisma.eventAttendee.findUnique.mockResolvedValue(null);

      await expect(
        service.respond('group-1', 'event-1', 'user-3', { status: 'confirmed' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should mark event confirmed when all confirm', async () => {
      prisma.eventAttendee.findUnique.mockResolvedValue({ eventId: 'event-1', userId: 'user-2' });
      prisma.eventAttendee.update.mockResolvedValue({});
      prisma.eventAttendee.findMany.mockResolvedValue([
        { userId: 'user-1', status: 'confirmed' },
        { userId: 'user-2', status: 'confirmed' },
      ]);
      prisma.event.update.mockResolvedValue({});
      prisma.event.findUnique.mockResolvedValue(createTestEvent());
      prisma.event.findFirst.mockResolvedValue({
        ...createTestEvent(),
        attendees: [],
        createdBy: createTestUser(),
      });

      await service.respond('group-1', 'event-1', 'user-2', { status: 'confirmed' });

      expect(prisma.event.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'confirmed' },
        }),
      );
    });

    it('should send notification when all confirmed', async () => {
      prisma.eventAttendee.findUnique.mockResolvedValue({ eventId: 'event-1', userId: 'user-2' });
      prisma.eventAttendee.update.mockResolvedValue({});
      prisma.eventAttendee.findMany.mockResolvedValue([
        { userId: 'user-1', status: 'confirmed' },
        { userId: 'user-2', status: 'confirmed' },
      ]);
      prisma.event.update.mockResolvedValue({});
      prisma.event.findUnique.mockResolvedValue(createTestEvent());
      prisma.event.findFirst.mockResolvedValue({
        ...createTestEvent(),
        attendees: [],
        createdBy: createTestUser(),
      });

      await service.respond('group-1', 'event-1', 'user-2', { status: 'confirmed' });

      expect(notifications.sendToEventAttendees).toHaveBeenCalledWith(
        'event-1',
        'Quedada confirmada',
        expect.any(String),
        undefined,
        expect.objectContaining({ type: 'event_confirmed' }),
        'event_confirmed',
        'confirmed',
      );
    });

    it('should not resend event_confirmed when re-confirming an already confirmed event', async () => {
      prisma.event.findFirst.mockResolvedValue({
        ...createTestEvent({ status: 'confirmed' }),
        attendees: [],
        createdBy: createTestUser(),
      });
      prisma.eventAttendee.findUnique.mockResolvedValue({
        eventId: 'event-1',
        userId: 'user-2',
        status: 'confirmed',
      });
      prisma.eventAttendee.update.mockResolvedValue({});
      prisma.eventAttendee.findMany.mockResolvedValue([
        { userId: 'user-1', status: 'confirmed' },
        { userId: 'user-2', status: 'confirmed' },
      ]);
      prisma.event.update.mockResolvedValue({});
      prisma.event.findUnique.mockResolvedValue(createTestEvent({ status: 'confirmed' }));

      await service.respond('group-1', 'event-1', 'user-2', { status: 'confirmed' });

      expect(notifications.sendToEventAttendees).not.toHaveBeenCalled();
    });

    it('should take the all-confirmed decision inside the transaction (single attendee read)', async () => {
      prisma.eventAttendee.findUnique.mockResolvedValue({ eventId: 'event-1', userId: 'user-2' });
      prisma.eventAttendee.update.mockResolvedValue({});
      prisma.eventAttendee.findMany.mockResolvedValue([
        { userId: 'user-1', status: 'confirmed' },
        { userId: 'user-2', status: 'confirmed' },
      ]);
      prisma.event.update.mockResolvedValue({});
      prisma.event.findUnique.mockResolvedValue(createTestEvent());
      prisma.event.findFirst.mockResolvedValue({
        ...createTestEvent(),
        attendees: [],
        createdBy: createTestUser(),
      });

      await service.respond('group-1', 'event-1', 'user-2', { status: 'confirmed' });

      expect(prisma.eventAttendee.findMany).toHaveBeenCalledTimes(1);
    });

    it('should keep event pending when someone declines', async () => {
      prisma.eventAttendee.findUnique.mockResolvedValue({ eventId: 'event-1', userId: 'user-2' });
      prisma.eventAttendee.update.mockResolvedValue({});
      prisma.eventAttendee.findMany.mockResolvedValue([
        { userId: 'user-1', status: 'confirmed' },
        { userId: 'user-2', status: 'declined' },
      ]);
      prisma.event.update.mockResolvedValue({});
      prisma.user.findUnique.mockResolvedValue(createTestUser({ id: 'user-2' }));
      prisma.event.findUnique.mockResolvedValue(createTestEvent());
      prisma.event.findFirst.mockResolvedValue({
        ...createTestEvent(),
        attendees: [],
        createdBy: createTestUser(),
      });

      await service.respond('group-1', 'event-1', 'user-2', { status: 'declined' });

      expect(prisma.event.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'pending' },
        }),
      );
    });

    it('should send decline notification', async () => {
      prisma.eventAttendee.findUnique.mockResolvedValue({ eventId: 'event-1', userId: 'user-2' });
      prisma.eventAttendee.update.mockResolvedValue({});
      prisma.eventAttendee.findMany.mockResolvedValue([
        { userId: 'user-1', status: 'confirmed' },
        { userId: 'user-2', status: 'declined' },
      ]);
      prisma.event.update.mockResolvedValue({});
      prisma.user.findUnique.mockResolvedValue(createTestUser({ id: 'user-2', name: 'User 2' }));
      prisma.event.findUnique.mockResolvedValue(createTestEvent());
      prisma.event.findFirst.mockResolvedValue({
        ...createTestEvent(),
        attendees: [],
        createdBy: createTestUser(),
      });

      await service.respond('group-1', 'event-1', 'user-2', { status: 'declined' });

      expect(notifications.sendToEventAttendees).toHaveBeenCalledWith(
        'event-1',
        'Asistencia rechazada',
        expect.stringContaining('User 2'),
        'user-2',
        expect.objectContaining({ type: 'event_declined' }),
        'event_declined',
        'confirmed',
      );
    });
  });

  describe('update', () => {
    it('should update event title', async () => {
      const event = {
        ...createTestEvent(),
        createdBy: createTestUser(),
        attendees: [],
      };
      prisma.event.findFirst.mockResolvedValue(event);
      prisma.event.update.mockResolvedValue({ ...event, title: 'Updated' });

      const result = await service.update('group-1', 'event-1', 'user-1', {
        title: 'Updated',
      });

      expect(prisma.event.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'event-1' },
          data: expect.objectContaining({ title: 'Updated' }),
        }),
      );
    });

    it('should reject update from non-creator', async () => {
      const event = {
        ...createTestEvent(),
        createdBy: createTestUser(),
        attendees: [],
      };
      prisma.event.findFirst.mockResolvedValue(event);

      await expect(
        service.update('group-1', 'event-1', 'user-2', { title: 'Hack' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject update to past date', async () => {
      const event = {
        ...createTestEvent(),
        createdBy: createTestUser(),
        attendees: [],
      };
      prisma.event.findFirst.mockResolvedValue(event);

      await expect(
        service.update('group-1', 'event-1', 'user-1', { date: '2020-01-01' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should store updated date as UTC midnight', async () => {
      const event = {
        ...createTestEvent(),
        createdBy: createTestUser(),
        attendees: [],
      };
      prisma.event.findFirst.mockResolvedValue(event);
      prisma.event.update.mockResolvedValue({ ...event, date: new Date('2026-12-15T00:00:00Z') });

      await service.update('group-1', 'event-1', 'user-1', { date: '2026-12-15' });

      const updateCall = prisma.event.update.mock.calls[0][0];
      const storedDate = updateCall.data.date as Date;
      expect(storedDate.toISOString()).toBe('2026-12-15T00:00:00.000Z');
    });

    it('should send notification on update', async () => {
      const event = {
        ...createTestEvent(),
        createdBy: createTestUser(),
        attendees: [],
      };
      prisma.event.findFirst.mockResolvedValue(event);
      prisma.event.update.mockResolvedValue(event);

      await service.update('group-1', 'event-1', 'user-1', { title: 'Updated' });

      expect(notifications.sendToEventAttendees).toHaveBeenCalledWith(
        'event-1',
        'Quedada actualizada',
        expect.any(String),
        'user-1',
        expect.objectContaining({ type: 'event_updated' }),
        'event_updated',
      );
    });

    it('should reject when endTime is before time on update', async () => {
      const event = {
        ...createTestEvent({ time: '16:00', endTime: '20:00' }),
        createdBy: createTestUser(),
        attendees: [],
      };
      prisma.event.findFirst.mockResolvedValue(event);

      await expect(
        service.update('group-1', 'event-1', 'user-1', { endTime: '14:00' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow valid endTime update', async () => {
      const event = {
        ...createTestEvent({ time: '16:00', endTime: '20:00' }),
        createdBy: createTestUser(),
        attendees: [],
      };
      prisma.event.findFirst.mockResolvedValue(event);
      prisma.event.update.mockResolvedValue({ ...event, endTime: '22:00' });

      const result = await service.update('group-1', 'event-1', 'user-1', { endTime: '22:00' });

      expect(prisma.event.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ endTime: '22:00' }),
        }),
      );
    });

    it('should update location coordinates', async () => {
      const event = {
        ...createTestEvent(),
        createdBy: createTestUser(),
        attendees: [],
      };
      prisma.event.findFirst.mockResolvedValue(event);
      prisma.event.update.mockResolvedValue({
        ...event,
        locationLat: 40.4153,
        locationLon: -3.6845,
      });

      await service.update('group-1', 'event-1', 'user-1', {
        locationLat: 40.4153,
        locationLon: -3.6845,
      });

      expect(prisma.event.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            locationLat: 40.4153,
            locationLon: -3.6845,
          }),
        }),
      );
    });

    it('should clear coordinates when location is cleared', async () => {
      const event = {
        ...createTestEvent({
          location: 'Retiro Park',
        }),
        createdBy: createTestUser(),
        attendees: [],
      };
      prisma.event.findFirst.mockResolvedValue(event);
      prisma.event.update.mockResolvedValue({
        ...event,
        location: '',
        locationLat: null,
        locationLon: null,
      });

      await service.update('group-1', 'event-1', 'user-1', { location: '' });

      expect(prisma.event.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            location: '',
            locationLat: null,
            locationLon: null,
          }),
        }),
      );
    });

    it('should update multiple fields at once', async () => {
      const event = {
        ...createTestEvent(),
        createdBy: createTestUser(),
        attendees: [],
      };
      prisma.event.findFirst.mockResolvedValue(event);
      prisma.event.update.mockResolvedValue({
        ...event,
        title: 'New Title',
        description: 'New Desc',
        location: 'New Place',
      });

      await service.update('group-1', 'event-1', 'user-1', {
        title: 'New Title',
        description: 'New Desc',
        location: 'New Place',
      });

      expect(prisma.event.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'New Title',
            description: 'New Desc',
            location: 'New Place',
          }),
        }),
      );
    });
  });

  describe('delete', () => {
    it('should delete event as creator', async () => {
      const event = {
        ...createTestEvent(),
        createdBy: createTestUser(),
        attendees: [],
      };
      prisma.event.findFirst.mockResolvedValue(event);
      prisma.event.delete.mockResolvedValue(event);

      const result = await service.delete('group-1', 'event-1', 'user-1');

      expect(result).toEqual({ success: true });
      expect(prisma.event.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'event-1' } }),
      );
    });

    it('should reject delete from non-creator', async () => {
      const event = {
        ...createTestEvent(),
        createdBy: createTestUser(),
        attendees: [],
      };
      prisma.event.findFirst.mockResolvedValue(event);

      await expect(service.delete('group-1', 'event-1', 'user-2')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should send notification on delete', async () => {
      const event = {
        ...createTestEvent(),
        createdBy: createTestUser(),
        attendees: [],
      };
      prisma.event.findFirst.mockResolvedValue(event);
      prisma.event.delete.mockResolvedValue(event);

      await service.delete('group-1', 'event-1', 'user-1');

      expect(notifications.sendToEventAttendees).toHaveBeenCalledWith(
        'event-1',
        'Quedada eliminada',
        expect.stringContaining('Test Event'),
        'user-1',
        expect.objectContaining({ type: 'event_deleted' }),
        'event_deleted',
      );
    });
  });

  describe('cancel', () => {
    it('should cancel event as creator', async () => {
      const event = {
        ...createTestEvent(),
        createdBy: createTestUser(),
        attendees: [],
      };
      prisma.event.findFirst.mockResolvedValue(event);
      prisma.event.update.mockResolvedValue({ ...event, status: 'cancelled' });

      const result = await service.cancel('group-1', 'event-1', 'user-1');

      expect(prisma.event.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'cancelled' },
        }),
      );
    });

    it('should reject cancel from non-creator', async () => {
      const event = {
        ...createTestEvent(),
        createdBy: createTestUser(),
        attendees: [],
      };
      prisma.event.findFirst.mockResolvedValue(event);

      await expect(service.cancel('group-1', 'event-1', 'user-2')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should send notification on cancel', async () => {
      const event = {
        ...createTestEvent(),
        createdBy: createTestUser(),
        attendees: [],
      };
      prisma.event.findFirst.mockResolvedValue(event);
      prisma.event.update.mockResolvedValue({ ...event, status: 'cancelled' });

      await service.cancel('group-1', 'event-1', 'user-1');

      expect(notifications.sendToEventAttendees).toHaveBeenCalledWith(
        'event-1',
        'Quedada cancelada',
        expect.stringContaining('Test Event'),
        'user-1',
        expect.objectContaining({ type: 'event_cancelled' }),
        'event_cancelled',
      );
    });

    it('should return updated event with cancelled status', async () => {
      const event = {
        ...createTestEvent(),
        createdBy: createTestUser(),
        attendees: [],
      };
      prisma.event.findFirst.mockResolvedValue(event);
      const cancelled = { ...event, status: 'cancelled' };
      prisma.event.update.mockResolvedValue(cancelled);

      const result = await service.cancel('group-1', 'event-1', 'user-1');

      expect(result.status).toBe('cancelled');
    });
  });

  describe('confirm', () => {
    it('should confirm pending event as creator', async () => {
      const event = {
        ...createTestEvent(),
        createdBy: createTestUser(),
        attendees: [],
      };
      prisma.event.findFirst.mockResolvedValue(event);
      prisma.event.update.mockResolvedValue({ ...event, status: 'confirmed' });

      const result = await service.confirm('group-1', 'event-1', 'user-1');

      expect(prisma.event.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'confirmed' },
        }),
      );
    });

    it('should reject confirm from non-creator', async () => {
      const event = {
        ...createTestEvent(),
        createdBy: createTestUser(),
        attendees: [],
      };
      prisma.event.findFirst.mockResolvedValue(event);

      await expect(service.confirm('group-1', 'event-1', 'user-2')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should reject confirm for non-pending event', async () => {
      const event = {
        ...createTestEvent({ status: 'confirmed' }),
        createdBy: createTestUser(),
        attendees: [],
      };
      prisma.event.findFirst.mockResolvedValue(event);

      await expect(service.confirm('group-1', 'event-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject confirm for cancelled event', async () => {
      const event = {
        ...createTestEvent({ status: 'cancelled' }),
        createdBy: createTestUser(),
        attendees: [],
      };
      prisma.event.findFirst.mockResolvedValue(event);

      await expect(service.confirm('group-1', 'event-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should send notification on confirm', async () => {
      const event = {
        ...createTestEvent(),
        createdBy: createTestUser(),
        attendees: [],
      };
      prisma.event.findFirst.mockResolvedValue(event);
      prisma.event.update.mockResolvedValue({ ...event, status: 'confirmed' });

      await service.confirm('group-1', 'event-1', 'user-1');

      expect(notifications.sendToEventAttendees).toHaveBeenCalledWith(
        'event-1',
        'Quedada confirmada',
        expect.stringContaining('Test Event'),
        'user-1',
        expect.objectContaining({ type: 'event_confirmed' }),
        'event_confirmed',
      );
    });

    it('should return updated event with confirmed status', async () => {
      const event = {
        ...createTestEvent(),
        createdBy: createTestUser(),
        attendees: [],
      };
      prisma.event.findFirst.mockResolvedValue(event);
      const confirmed = { ...event, status: 'confirmed' };
      prisma.event.update.mockResolvedValue(confirmed);

      const result = await service.confirm('group-1', 'event-1', 'user-1');

      expect(result.status).toBe('confirmed');
    });
  });

  describe('online events', () => {
    it('should create online event with null location fields', async () => {
      const event = {
        ...createTestEvent({
          isOnline: true,
          location: null,
          locationLat: null,
          locationLon: null,
        }),
        createdBy: createTestUser(),
        attendees: [],
      };
      prisma.event.create.mockResolvedValue(event);

      await service.create('group-1', 'user-1', {
        title: 'Online Event',
        date: '2026-12-01',
        isOnline: true,
        location: 'Madrid',
        locationLat: 40.4153,
        locationLon: -3.6845,
      });

      expect(prisma.event.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isOnline: true,
            location: null,
            locationLat: null,
            locationLon: null,
          }),
        }),
      );
    });

    it('should save meetingUrl for online event', async () => {
      const event = {
        ...createTestEvent({ isOnline: true, meetingUrl: 'https://meet.google.com/abc' }),
        createdBy: createTestUser(),
        attendees: [],
      };
      prisma.event.create.mockResolvedValue(event);

      await service.create('group-1', 'user-1', {
        title: 'Online Event',
        date: '2026-12-01',
        isOnline: true,
        meetingUrl: 'https://meet.google.com/abc',
      });

      expect(prisma.event.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isOnline: true,
            meetingUrl: 'https://meet.google.com/abc',
          }),
        }),
      );
    });

    it('should clear meetingUrl for presencial event', async () => {
      const event = {
        ...createTestEvent(),
        createdBy: createTestUser(),
        attendees: [],
      };
      prisma.event.create.mockResolvedValue(event);

      await service.create('group-1', 'user-1', {
        title: 'Presencial Event',
        date: '2026-12-01',
        isOnline: false,
        meetingUrl: 'https://meet.google.com/abc',
      });

      expect(prisma.event.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isOnline: false,
            meetingUrl: null,
          }),
        }),
      );
    });

    it('should switch to online and clear location on update', async () => {
      const event = {
        ...createTestEvent({ location: 'Retiro Park', locationLat: 40.4153, locationLon: -3.6845 }),
        createdBy: createTestUser(),
        attendees: [],
      };
      prisma.event.findFirst.mockResolvedValue(event);
      prisma.event.update.mockResolvedValue({
        ...event,
        isOnline: true,
        location: null,
        locationLat: null,
        locationLon: null,
      });

      await service.update('group-1', 'event-1', 'user-1', {
        isOnline: true,
      });

      expect(prisma.event.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isOnline: true,
            location: null,
            locationLat: null,
            locationLon: null,
          }),
        }),
      );
    });

    it('should switch to presencial and clear meetingUrl on update', async () => {
      const event = {
        ...createTestEvent({ isOnline: true, meetingUrl: 'https://meet.google.com/abc' }),
        createdBy: createTestUser(),
        attendees: [],
      };
      prisma.event.findFirst.mockResolvedValue(event);
      prisma.event.update.mockResolvedValue({
        ...event,
        isOnline: false,
        meetingUrl: null,
      });

      await service.update('group-1', 'event-1', 'user-1', {
        isOnline: false,
      });

      expect(prisma.event.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isOnline: false,
            meetingUrl: null,
          }),
        }),
      );
    });
  });
});
