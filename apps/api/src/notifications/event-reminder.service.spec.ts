import { EventReminderService } from './event-reminder.service';
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
    service = new EventReminderService(prisma as any, notifications as any);
    prisma.event.update.mockResolvedValue({});
  });

  describe('combineDateTime', () => {
    // Access private method via bracket notation for testing
    const combine = (date: Date, time: string | null) =>
      (service as any).combineDateTime(date, time);

    it('should combine date and time correctly', () => {
      const date = new Date('2026-03-15T00:00:00.000Z');
      const result = combine(date, '14:30');

      expect(result.getUTCHours()).toBe(14);
      expect(result.getUTCMinutes()).toBe(30);
      expect(result.getUTCSeconds()).toBe(0);
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

      expect(result.getUTCHours()).toBe(23);
      expect(result.getUTCMinutes()).toBe(59);
    });

    it('should handle early morning time', () => {
      const date = new Date('2026-03-15T00:00:00.000Z');
      const result = combine(date, '00:00');

      expect(result.getUTCHours()).toBe(0);
      expect(result.getUTCMinutes()).toBe(0);
    });

    it('should not mutate the original date', () => {
      const date = new Date('2026-03-15T00:00:00.000Z');
      const original = date.getTime();
      combine(date, '14:30');

      expect(date.getTime()).toBe(original);
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
