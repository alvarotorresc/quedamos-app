import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
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

    it('should use attendeeStatusMap for pre-set attendee statuses', async () => {
      const event = {
        ...createTestEvent(),
        createdBy: createTestUser(),
        attendees: [
          { userId: 'user-1', status: 'confirmed' },
          { userId: 'user-2', status: 'declined' },
        ],
      };
      prisma.event.create.mockResolvedValue(event);

      await service.create('group-1', 'user-1', {
        title: 'From Proposal',
        date: '2026-12-01',
        attendeeStatusMap: {
          'user-2': 'declined',
        },
      });

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
  });

  describe('respond', () => {
    beforeEach(() => {
      prisma.event.findFirst.mockResolvedValue(createTestEvent());
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
        'event_confirmed',
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
        'event_declined',
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

    it('should send notification on update', async () => {
      const event = {
        ...createTestEvent(),
        createdBy: createTestUser(),
        attendees: [],
      };
      prisma.event.findFirst.mockResolvedValue(event);
      prisma.event.update.mockResolvedValue(event);

      await service.update('group-1', 'event-1', 'user-1', { title: 'Updated' });

      expect(notifications.sendToGroup).toHaveBeenCalledWith(
        'group-1',
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

      expect(notifications.sendToGroup).toHaveBeenCalledWith(
        'group-1',
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

      expect(notifications.sendToGroup).toHaveBeenCalledWith(
        'group-1',
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
});
