import { EventReminderService } from './event-reminder.service';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  createMockPrisma,
  createMockNotificationsService,
  createTestEvent,
} from '../common/test-utils';

/**
 * Returns a date (midnight UTC) and time (HH:MM) that, when combined by
 * combineDateTime, always fall exactly 12 hours from now — safely inside
 * the service's "next 24h" reminder window regardless of when tests run.
 */
function eventIn12Hours(): { date: Date; time: string } {
  const target = new Date(Date.now() + 12 * 60 * 60 * 1000);
  const date = new Date(target);
  date.setUTCHours(0, 0, 0, 0);
  const hours = String(target.getUTCHours()).padStart(2, '0');
  const minutes = String(target.getUTCMinutes()).padStart(2, '0');
  return { date, time: `${hours}:${minutes}` };
}

describe('EventReminderService', () => {
  let service: EventReminderService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let notifications: ReturnType<typeof createMockNotificationsService>;

  beforeEach(() => {
    prisma = createMockPrisma();
    notifications = createMockNotificationsService();
    service = new EventReminderService(
      prisma as unknown as PrismaService,
      notifications as unknown as NotificationsService,
    );
    prisma.event.update.mockResolvedValue({});
  });

  describe('combineDateTime', () => {
    // Access private method via bracket notation for testing
    const combine = (date: Date, time: string | null) =>
      (
        service as unknown as { combineDateTime: (d: Date, t: string | null) => Date }
      ).combineDateTime(date, time);

    it('should combine date and time correctly (Madrid wall-clock)', () => {
      const date = new Date('2026-03-15T00:00:00.000Z');
      const result = combine(date, '14:30');

      // 14:30 Madrid (CET, UTC+1) === 13:30 UTC
      expect(result.toISOString()).toBe('2026-03-15T13:30:00.000Z');
    });

    it('should default to midnight when time is null', () => {
      const date = new Date('2026-03-15T00:00:00.000Z');
      const result = combine(date, null);

      expect(result.getUTCHours()).toBe(0);
      expect(result.getUTCMinutes()).toBe(0);
    });

    it('should handle time near midnight', () => {
      const date = new Date('2026-03-15T00:00:00.000Z');
      const result = combine(date, '23:59');

      // 23:59 Madrid (CET) === 22:59 UTC same day
      expect(result.toISOString()).toBe('2026-03-15T22:59:00.000Z');
    });

    it('should handle early morning time', () => {
      const date = new Date('2026-03-15T00:00:00.000Z');
      const result = combine(date, '00:00');

      // 00:00 Madrid (CET) === 23:00 UTC of the previous day
      expect(result.toISOString()).toBe('2026-03-14T23:00:00.000Z');
    });

    it('should not mutate the original date', () => {
      const date = new Date('2026-03-15T00:00:00.000Z');
      const original = date.getTime();
      combine(date, '14:30');

      expect(date.getTime()).toBe(original);
    });

    it('should interpret time as Europe/Madrid wall-clock in winter (CET, UTC+1)', () => {
      const date = new Date('2026-01-15T00:00:00.000Z');
      const result = combine(date, '18:00');

      expect(result.toISOString()).toBe('2026-01-15T17:00:00.000Z');
    });

    it('should interpret time as Europe/Madrid wall-clock in summer (CEST, UTC+2)', () => {
      const date = new Date('2026-07-15T00:00:00.000Z');
      const result = combine(date, '18:00');

      expect(result.toISOString()).toBe('2026-07-15T16:00:00.000Z');
    });
  });

  describe('sendReminders', () => {
    it('should skip when no events found', async () => {
      prisma.event.findMany.mockResolvedValue([]);

      await service.sendReminders();

      expect(notifications.sendToUser).not.toHaveBeenCalled();
    });

    it('should send reminders to pending and confirmed attendees', async () => {
      const { date, time } = eventIn12Hours();

      const event = {
        ...createTestEvent({ date, time, reminderSentAt: null }),
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

    it('should await all notifications before marking reminderSentAt', async () => {
      const { date, time } = eventIn12Hours();

      const callOrder: string[] = [];
      notifications.sendToUser.mockImplementation(async () => {
        callOrder.push('sendToUser');
        return { sent: 1 };
      });
      prisma.event.update.mockImplementation(async () => {
        callOrder.push('event.update');
        return {};
      });

      const event = {
        ...createTestEvent({ date, time, reminderSentAt: null }),
        attendees: [{ userId: 'user-1', status: 'pending' }],
        group: { name: 'Test Group' },
      };
      prisma.event.findMany.mockResolvedValue([event]);

      await service.sendReminders();

      expect(callOrder).toEqual(['sendToUser', 'event.update']);
    });

    it('should mark reminderSentAt after sending', async () => {
      const { date, time } = eventIn12Hours();

      const event = {
        ...createTestEvent({ date, time, reminderSentAt: null }),
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

    it('should still mark reminderSentAt even if some notifications fail', async () => {
      const { date, time } = eventIn12Hours();

      notifications.sendToUser
        .mockResolvedValueOnce({ sent: 1 })
        .mockRejectedValueOnce(new Error('FCM down'));

      const event = {
        ...createTestEvent({ date, time, reminderSentAt: null }),
        attendees: [
          { userId: 'user-1', status: 'pending' },
          { userId: 'user-2', status: 'confirmed' },
        ],
        group: { name: 'Test Group' },
      };
      prisma.event.findMany.mockResolvedValue([event]);

      await service.sendReminders();

      // Should still mark as sent (Promise.allSettled handles failures)
      expect(prisma.event.update).toHaveBeenCalledWith({
        where: { id: 'event-1' },
        data: { reminderSentAt: expect.any(Date) },
      });
    });

    it('should skip events with no attendees', async () => {
      const { date, time } = eventIn12Hours();

      const event = {
        ...createTestEvent({ date, time, reminderSentAt: null }),
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

    it('should process attendees in batches to limit concurrent DB connections', async () => {
      const { date, time } = eventIn12Hours();

      // Create 25 attendees to force multiple batches (BATCH_SIZE = 10)
      const attendees = Array.from({ length: 25 }, (_, i) => ({
        userId: `user-${i + 1}`,
        status: 'confirmed',
      }));

      const callOrder: number[] = [];
      let callCount = 0;
      notifications.sendToUser.mockImplementation(async () => {
        callCount++;
        callOrder.push(callCount);
        return { sent: 1 };
      });

      const event = {
        ...createTestEvent({ date, time, reminderSentAt: null }),
        attendees,
        group: { name: 'Test Group' },
      };
      prisma.event.findMany.mockResolvedValue([event]);

      await service.sendReminders();

      // All 25 attendees should receive notifications
      expect(notifications.sendToUser).toHaveBeenCalledTimes(25);
    });

    it('should use event_reminder as notificationType', async () => {
      const { date, time } = eventIn12Hours();

      const event = {
        ...createTestEvent({ date, time, reminderSentAt: null }),
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
