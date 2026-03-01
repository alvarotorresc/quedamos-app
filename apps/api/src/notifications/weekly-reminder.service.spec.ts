import { WeeklyReminderService } from './weekly-reminder.service';
import {
  createMockPrisma,
  createMockNotificationsService,
} from '../common/test-utils';

describe('WeeklyReminderService', () => {
  let service: WeeklyReminderService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let notifications: ReturnType<typeof createMockNotificationsService>;

  beforeEach(() => {
    prisma = createMockPrisma();
    notifications = createMockNotificationsService();
    service = new WeeklyReminderService(prisma as any, notifications as any);
  });

  describe('getNextWeekRange', () => {
    it('should return Monday to Sunday of next week', () => {
      const { nextMonday, nextSunday } = service.getNextWeekRange();

      expect(nextMonday.getUTCDay()).toBe(1); // Monday
      expect(nextSunday.getUTCDay()).toBe(0); // Sunday
      expect(nextMonday < nextSunday).toBe(true);
    });

    it('should return future dates', () => {
      const { nextMonday } = service.getNextWeekRange();
      const now = new Date();

      expect(nextMonday.getTime()).toBeGreaterThan(now.getTime());
    });
  });

  describe('sendWeeklyReminders', () => {
    it('should skip if no group members exist', async () => {
      prisma.groupMember.findMany.mockResolvedValue([]);

      await service.sendWeeklyReminders();

      expect(notifications.sendToUser).not.toHaveBeenCalled();
    });

    it('should skip users who already have availability', async () => {
      prisma.groupMember.findMany.mockResolvedValue([
        { userId: 'user-1' },
        { userId: 'user-2' },
      ]);
      prisma.availability.findMany.mockResolvedValue([
        { userId: 'user-1' },
        { userId: 'user-2' },
      ]);

      await service.sendWeeklyReminders();

      expect(notifications.sendToUser).not.toHaveBeenCalled();
    });

    it('should send to users without availability', async () => {
      prisma.groupMember.findMany.mockResolvedValue([
        { userId: 'user-1' },
        { userId: 'user-2' },
        { userId: 'user-3' },
      ]);
      prisma.availability.findMany.mockResolvedValue([
        { userId: 'user-1' },
      ]);

      await service.sendWeeklyReminders();

      expect(notifications.sendToUser).toHaveBeenCalledTimes(2);
      expect(notifications.sendToUser).toHaveBeenCalledWith(
        'user-2',
        'Marca tu disponibilidad',
        expect.any(String),
        expect.objectContaining({ type: 'weekly_availability_reminder' }),
        'weekly_availability_reminder',
      );
      expect(notifications.sendToUser).toHaveBeenCalledWith(
        'user-3',
        'Marca tu disponibilidad',
        expect.any(String),
        expect.objectContaining({ type: 'weekly_availability_reminder' }),
        'weekly_availability_reminder',
      );
    });

    it('should not send duplicates for users in multiple groups', async () => {
      prisma.groupMember.findMany.mockResolvedValue([
        { userId: 'user-1' },
        { userId: 'user-1' }, // same user in different group
        { userId: 'user-2' },
      ]);
      prisma.availability.findMany.mockResolvedValue([]);

      await service.sendWeeklyReminders();

      expect(notifications.sendToUser).toHaveBeenCalledTimes(2);
    });

    it('should pass weekly_availability_reminder as notificationType', async () => {
      prisma.groupMember.findMany.mockResolvedValue([{ userId: 'user-1' }]);
      prisma.availability.findMany.mockResolvedValue([]);

      await service.sendWeeklyReminders();

      expect(notifications.sendToUser).toHaveBeenCalledWith(
        'user-1',
        expect.any(String),
        expect.any(String),
        expect.any(Object),
        'weekly_availability_reminder',
      );
    });
  });
});
