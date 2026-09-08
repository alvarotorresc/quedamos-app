import { WeeklyReminderService } from './weekly-reminder.service';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { createMockPrisma, createMockNotificationsService } from '../common/test-utils';

describe('WeeklyReminderService', () => {
  let service: WeeklyReminderService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let notifications: ReturnType<typeof createMockNotificationsService>;

  beforeEach(() => {
    prisma = createMockPrisma();
    notifications = createMockNotificationsService();
    service = new WeeklyReminderService(
      prisma as unknown as PrismaService,
      notifications as unknown as NotificationsService,
    );
  });

  describe('getNextWeekRange', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

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

    it('should return correct range when called on a Monday', () => {
      // 2026-03-02 is a Monday
      jest.useFakeTimers({ now: new Date('2026-03-02T12:00:00.000Z') });

      const { nextMonday, nextSunday } = service.getNextWeekRange();

      // Next Monday should be March 9
      expect(nextMonday.getUTCDate()).toBe(9);
      expect(nextMonday.getUTCMonth()).toBe(2); // March
      expect(nextSunday.getUTCDate()).toBe(15);
    });

    it('should return correct range when called on a Saturday', () => {
      // 2026-03-07 is a Saturday
      jest.useFakeTimers({ now: new Date('2026-03-07T12:00:00.000Z') });

      const { nextMonday, nextSunday } = service.getNextWeekRange();

      // Next Monday should be March 9
      expect(nextMonday.getUTCDate()).toBe(9);
      expect(nextMonday.getUTCMonth()).toBe(2);
      expect(nextSunday.getUTCDate()).toBe(15);
    });

    it('should return correct range when called on a Sunday', () => {
      // 2026-03-01 is a Sunday
      jest.useFakeTimers({ now: new Date('2026-03-01T20:00:00.000Z') });

      const { nextMonday, nextSunday } = service.getNextWeekRange();

      // Next Monday should be March 2 (tomorrow)
      expect(nextMonday.getUTCDate()).toBe(2);
      expect(nextMonday.getUTCMonth()).toBe(2);
      expect(nextSunday.getUTCDate()).toBe(8);
    });

    it('should set Monday to start of day and Sunday to end of day', () => {
      const { nextMonday, nextSunday } = service.getNextWeekRange();

      expect(nextMonday.getUTCHours()).toBe(0);
      expect(nextMonday.getUTCMinutes()).toBe(0);
      expect(nextSunday.getUTCHours()).toBe(23);
      expect(nextSunday.getUTCMinutes()).toBe(59);
    });
  });

  describe('sendWeeklyReminders', () => {
    it('should skip if no group members exist', async () => {
      prisma.groupMember.findMany.mockResolvedValue([]);

      await service.sendWeeklyReminders();

      expect(notifications.sendToUser).not.toHaveBeenCalled();
    });

    it('should skip users who already have availability', async () => {
      prisma.groupMember.findMany.mockResolvedValue([{ userId: 'user-1' }, { userId: 'user-2' }]);
      prisma.availability.findMany.mockResolvedValue([{ userId: 'user-1' }, { userId: 'user-2' }]);

      await service.sendWeeklyReminders();

      expect(notifications.sendToUser).not.toHaveBeenCalled();
    });

    it('should send to users without availability', async () => {
      prisma.groupMember.findMany.mockResolvedValue([
        { userId: 'user-1' },
        { userId: 'user-2' },
        { userId: 'user-3' },
      ]);
      prisma.availability.findMany.mockResolvedValue([{ userId: 'user-1' }]);

      await service.sendWeeklyReminders();

      expect(notifications.sendToUser).toHaveBeenCalledTimes(2);
      expect(notifications.sendToUser).toHaveBeenCalledWith(
        'user-2',
        'weekly_availability_reminder',
        {},
      );
      expect(notifications.sendToUser).toHaveBeenCalledWith(
        'user-3',
        'weekly_availability_reminder',
        {},
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

    it('should send the weekly_availability_reminder type', async () => {
      prisma.groupMember.findMany.mockResolvedValue([{ userId: 'user-1' }]);
      prisma.availability.findMany.mockResolvedValue([]);

      await service.sendWeeklyReminders();

      expect(notifications.sendToUser).toHaveBeenCalledWith(
        'user-1',
        'weekly_availability_reminder',
        {},
      );
    });

    it('should query availability for the correct next week range', async () => {
      jest.useFakeTimers({ now: new Date('2026-03-01T20:00:00.000Z') });

      prisma.groupMember.findMany.mockResolvedValue([{ userId: 'user-1' }]);
      prisma.availability.findMany.mockResolvedValue([]);

      await service.sendWeeklyReminders();

      expect(prisma.availability.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            date: {
              gte: expect.any(Date),
              lte: expect.any(Date),
            },
            userId: { in: ['user-1'] },
          }),
        }),
      );

      // Verify the actual dates in the query
      const call = prisma.availability.findMany.mock.calls[0][0];
      const queryMonday = call.where.date.gte;
      const querySunday = call.where.date.lte;
      expect(queryMonday.getUTCDay()).toBe(1); // Monday
      expect(querySunday.getUTCDay()).toBe(0); // Sunday
      expect(queryMonday.getUTCDate()).toBe(2); // March 2
      expect(querySunday.getUTCDate()).toBe(8); // March 8

      jest.useRealTimers();
    });

    // The cron fires at 20:00 in Madrid, and the week it asks about has to be the
    // Monday-to-Sunday the user sees on their calendar, not the one UTC is on.
    it('should be scheduled in Europe/Madrid', () => {
      const options = Reflect.getMetadata(
        'SCHEDULE_CRON_OPTIONS',
        WeeklyReminderService.prototype.sendWeeklyReminders,
      );

      expect(options).toEqual(expect.objectContaining({ timeZone: 'Europe/Madrid' }));
    });

    it('should take next week from the Madrid day, not the UTC one (winter)', () => {
      // Sunday 23:30 UTC is already Monday 00:30 in Madrid: next week starts on the 9th.
      const { nextMonday, nextSunday } = service.getNextWeekRange(
        new Date('2026-03-01T23:30:00.000Z'),
      );

      expect(nextMonday.toISOString().slice(0, 10)).toBe('2026-03-09');
      expect(nextSunday.toISOString().slice(0, 10)).toBe('2026-03-15');
    });

    it('should take next week from the Madrid day, not the UTC one (summer)', () => {
      // Sunday 22:30 UTC is Monday 00:30 in Madrid once CEST is in force.
      const { nextMonday, nextSunday } = service.getNextWeekRange(
        new Date('2026-07-05T22:30:00.000Z'),
      );

      expect(nextMonday.toISOString().slice(0, 10)).toBe('2026-07-13');
      expect(nextSunday.toISOString().slice(0, 10)).toBe('2026-07-19');
    });

    it('should start next week at UTC midnight, the way @db.Date rows are stored', () => {
      const { nextMonday } = service.getNextWeekRange(new Date('2026-03-01T20:00:00.000Z'));

      expect(nextMonday.toISOString()).toBe('2026-03-02T00:00:00.000Z');
    });

    it('should process users in batches to limit concurrent DB connections', async () => {
      // Create 25 users to force multiple batches (BATCH_SIZE = 10)
      const members = Array.from({ length: 25 }, (_, i) => ({
        userId: `user-${i + 1}`,
      }));
      prisma.groupMember.findMany.mockResolvedValue(members);
      prisma.availability.findMany.mockResolvedValue([]);

      await service.sendWeeklyReminders();

      expect(notifications.sendToUser).toHaveBeenCalledTimes(25);
    });

    it('should handle notification failures gracefully with Promise.allSettled', async () => {
      prisma.groupMember.findMany.mockResolvedValue([{ userId: 'user-1' }, { userId: 'user-2' }]);
      prisma.availability.findMany.mockResolvedValue([]);
      notifications.sendToUser
        .mockResolvedValueOnce({ sent: 1 })
        .mockRejectedValueOnce(new Error('FCM down'));

      // Should not throw
      await service.sendWeeklyReminders();

      expect(notifications.sendToUser).toHaveBeenCalledTimes(2);
    });
  });
});
