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
  });

  describe('sendReminders', () => {
    it('should skip when no events in next 24h', async () => {
      prisma.event.findMany.mockResolvedValue([]);

      await service.sendReminders();

      expect(notifications.sendToUser).not.toHaveBeenCalled();
    });

    it('should send reminders to pending attendees', async () => {
      const event = {
        ...createTestEvent(),
        attendees: [
          { userId: 'user-1', status: 'pending' },
          { userId: 'user-2', status: 'pending' },
        ],
        group: { name: 'Test Group' },
      };
      prisma.event.findMany.mockResolvedValue([event]);
      notifications.isNotificationEnabled.mockResolvedValue(true);

      await service.sendReminders();

      expect(notifications.sendToUser).toHaveBeenCalledTimes(2);
      expect(notifications.sendToUser).toHaveBeenCalledWith(
        'user-1',
        'Recordatorio',
        expect.stringContaining('Test Event'),
        expect.objectContaining({ type: 'event_reminder' }),
      );
    });

    it('should skip users with notifications disabled', async () => {
      const event = {
        ...createTestEvent(),
        attendees: [{ userId: 'user-1', status: 'pending' }],
        group: { name: 'Test Group' },
      };
      prisma.event.findMany.mockResolvedValue([event]);
      notifications.isNotificationEnabled.mockResolvedValue(false);

      await service.sendReminders();

      expect(notifications.sendToUser).not.toHaveBeenCalled();
    });

    it('should skip events with no pending attendees', async () => {
      const event = {
        ...createTestEvent(),
        attendees: [],
        group: { name: 'Test Group' },
      };
      prisma.event.findMany.mockResolvedValue([event]);

      await service.sendReminders();

      expect(notifications.sendToUser).not.toHaveBeenCalled();
    });

    it('should query events within 24h window', async () => {
      prisma.event.findMany.mockResolvedValue([]);

      await service.sendReminders();

      expect(prisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            date: expect.objectContaining({ gte: expect.any(Date), lte: expect.any(Date) }),
            status: { not: 'cancelled' },
          }),
        }),
      );
    });
  });
});
