import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from './notifications.service';

@Injectable()
export class EventReminderService {
  private readonly logger = new Logger(EventReminderService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async sendReminders() {
    const now = new Date();

    // date is @db.Date (date-only). Query broadly: today and tomorrow,
    // then filter precisely in code by combining date + time.
    const today = new Date(now);
    today.setUTCHours(0, 0, 0, 0);
    const dayAfterTomorrow = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000);

    const events = await this.prisma.event.findMany({
      where: {
        date: { gte: today, lt: dayAfterTomorrow },
        status: { not: 'cancelled' },
        reminderSentAt: null,
      },
      include: {
        attendees: {
          where: { status: { in: ['pending', 'confirmed'] } },
        },
        group: true,
      },
    });

    if (events.length === 0) return;

    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    for (const event of events) {
      const eventDateTime = this.combineDateTime(event.date, event.time);

      // Only send if event is within the next 24 hours
      if (eventDateTime <= now || eventDateTime > in24h) continue;

      const attendeeUserIds = event.attendees.map((a) => a.userId);
      if (attendeeUserIds.length === 0) continue;

      for (const userId of attendeeUserIds) {
        this.notificationsService
          .sendToUser(
            userId,
            'Recordatorio',
            `"${event.title}" es mañana`,
            { type: 'event_reminder', eventId: event.id, groupId: event.groupId },
            'event_reminder',
          )
          .catch((err) =>
            this.logger.error(`Failed to send reminder for event ${event.id} to user ${userId}`, err),
          );
      }

      // Mark as sent to prevent duplicates
      await this.prisma.event.update({
        where: { id: event.id },
        data: { reminderSentAt: new Date() },
      });

      this.logger.debug(
        `Sent reminders for "${event.title}" to ${attendeeUserIds.length} attendee(s)`,
      );
    }
  }

  private combineDateTime(date: Date, time: string | null): Date {
    const d = new Date(date);
    if (time) {
      const [hours, minutes] = time.split(':').map(Number);
      d.setUTCHours(hours, minutes, 0, 0);
    }
    return d;
  }
}
