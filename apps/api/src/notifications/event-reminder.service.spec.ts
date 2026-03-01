import { EventReminderService } from './event-reminder.service';
import {
  createMockPrisma,
  createMockNotificationsService,
  createTestEvent,
} from '../common/test-utils';

describe('EventReminderService', () => {
  let service: EventReminderService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let notifications: ReturnType<typeof createMockNotificationsService>;

  beforeEach(() => {
    prisma = createMockPrisma();
    notifications = createMockNotificationsService();
    service = new EventReminderService(prisma as any, notifications as any);
    prisma.event.update.mockResolvedValue({});
  });

  describe('sendReminders', () => {
    it('should skip when no events found', async () => {
      prisma.event.findMany.mockResolvedValue([]);

      await service.sendReminders();

      expect(notifications.sendToUser).not.toHaveBeenCalled();
    });

    it('should send reminders to pending and confirmed attendees', async () => {
      const tomorrow = new Date();
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      tomorrow.setUTCHours(0, 0, 0, 0);

      const event = {
        ...createTestEvent({ date: tomorrow, time: '10:00', reminderSentAt: null }),
        attendees: [
          { userId: 'user-1', status: 'pending' },
          { userId: 'user-2', status: 'confirmed' },
        ],
        group: { name: 'Test Group' },
      };
      prisma.event.findMany.mockResolvedValue([event]);

      await service.sendReminders();

      expect(notifications.sendToUser).toHaveBeenCalledTimes(2);
      expect(notifications.sendToUser).toHaveBeenCalledWith(
        'user-1',
        'Recordatorio',
        expect.stringContaining('Test Event'),
        expect.objectContaining({ type: 'event_reminder' }),
        'event_reminder',
      );
      expect(notifications.sendToUser).toHaveBeenCalledWith(
        'user-2',
        'Recordatorio',
        expect.stringContaining('Test Event'),
        expect.objectContaining({ type: 'event_reminder' }),
        'event_reminder',
      );
    });

    it('should mark reminderSentAt after sending', async () => {
      const tomorrow = new Date();
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      tomorrow.setUTCHours(0, 0, 0, 0);

      const event = {
        ...createTestEvent({ date: tomorrow, time: '10:00', reminderSentAt: null }),
        attendees: [{ userId: 'user-1', status: 'pending' }],
        group: { name: 'Test Group' },
      };
      prisma.event.findMany.mockResolvedValue([event]);

      await service.sendReminders();

      expect(prisma.event.update).toHaveBeenCalledWith({
        where: { id: 'event-1' },
        data: { reminderSentAt: expect.any(Date) },
      });
    });

    it('should skip events with no attendees', async () => {
      const tomorrow = new Date();
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      tomorrow.setUTCHours(0, 0, 0, 0);

      const event = {
        ...createTestEvent({ date: tomorrow, time: '10:00', reminderSentAt: null }),
        attendees: [],
        group: { name: 'Test Group' },
      };
      prisma.event.findMany.mockResolvedValue([event]);

      await service.sendReminders();

      expect(notifications.sendToUser).not.toHaveBeenCalled();
    });

    it('should skip events already past', async () => {
      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      yesterday.setUTCHours(0, 0, 0, 0);

      const event = {
        ...createTestEvent({ date: yesterday, time: '10:00', reminderSentAt: null }),
        attendees: [{ userId: 'user-1', status: 'pending' }],
        group: { name: 'Test Group' },
      };
      prisma.event.findMany.mockResolvedValue([event]);

      await service.sendReminders();

      expect(notifications.sendToUser).not.toHaveBeenCalled();
    });

    it('should query only events with reminderSentAt null', async () => {
      prisma.event.findMany.mockResolvedValue([]);

      await service.sendReminders();

      expect(prisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            reminderSentAt: null,
            status: { not: 'cancelled' },
          }),
        }),
      );
    });

    it('should use event_reminder as notificationType', async () => {
      const tomorrow = new Date();
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      tomorrow.setUTCHours(0, 0, 0, 0);

      const event = {
        ...createTestEvent({ date: tomorrow, time: '10:00', reminderSentAt: null }),
        attendees: [{ userId: 'user-1', status: 'confirmed' }],
        group: { name: 'Test Group' },
      };
      prisma.event.findMany.mockResolvedValue([event]);

      await service.sendReminders();

      expect(notifications.sendToUser).toHaveBeenCalledWith(
        'user-1',
        expect.any(String),
        expect.any(String),
        expect.any(Object),
        'event_reminder',
      );
    });
  });
});
