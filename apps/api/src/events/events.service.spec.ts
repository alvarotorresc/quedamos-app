import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventsService } from './events.service';
import { GroupsService } from '../groups/groups.service';
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
    service = new EventsService(prisma as any, groupsService as any, notifications as any);
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

      await expect(
        service.findById('group-1', 'nonexistent', 'user-1'),
      ).rejects.toThrow(NotFoundException);
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
      );
    });

    it('should reject events in the past', async () => {
      await expect(
        service.create('group-1', 'user-1', {
          title: 'Old Event',
          date: '2020-01-01',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('respond', () => {
    beforeEach(() => {
      prisma.event.findFirst.mockResolvedValue(createTestEvent());
    });

    it('should update attendee status to confirmed', async () => {
      prisma.eventAttendee.findUnique.mockResolvedValue({ eventId: 'event-1', userId: 'user-1', status: 'pending' });
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

      expect(notifications.sendToGroup).toHaveBeenCalledWith(
        'group-1',
        'Quedada confirmada',
        expect.any(String),
        undefined,
        expect.objectContaining({ type: 'event_confirmed' }),
      );
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

      expect(notifications.sendToGroup).toHaveBeenCalledWith(
        'group-1',
        'Asistencia rechazada',
        expect.stringContaining('User 2'),
        'user-2',
        expect.objectContaining({ type: 'event_declined' }),
      );
    });
  });
});
