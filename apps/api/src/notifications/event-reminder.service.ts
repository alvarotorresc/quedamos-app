import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from './notifications.service';

/**
 * Timezone used to interpret event wall-clock times (event.time).
 * v0.1 hardcodes the group timezone to Europe/Madrid; v0.2 will make it
 * configurable per group.
 */
const DEFAULT_TIMEZONE = 'Europe/Madrid';

@Injectable()
export class EventReminderService {
  private readonly logger = new Logger(EventReminderService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  // NOTE: Cron jobs assume single-instance deployment. The reminderSentAt column
  // provides idempotency, but there is a small race window between findMany and update.
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

      // Process in batches to avoid exhausting the database connection pool
      const BATCH_SIZE = 10;
      for (let i = 0; i < attendeeUserIds.length; i += BATCH_SIZE) {
        const batch = attendeeUserIds.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
          batch.map((userId) =>
            this.notificationsService.sendToUser(
              userId,
              'Recordatorio',
              `"${event.title}" es mañana`,
              { type: 'event_reminder', eventId: event.id, groupId: event.groupId },
              'event_reminder',
            ),
          ),
        );

        for (const result of results) {
          if (result.status === 'rejected') {
            this.logger.error(`Failed to send reminder for event ${event.id}`, result.reason);
          }
        }
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
    if (!time) {
      return d;
    }

    const [hours, minutes] = time.split(':').map(Number);

    // Naive guess: read the wall-clock time as if it were UTC…
    const utcGuess = new Date(d);
    utcGuess.setUTCHours(hours, minutes, 0, 0);

    // …then correct by the zone offset. Re-check once so instants right at a
    // DST boundary use the offset of the corrected instant, not the guess.
    const offset1 = this.getTimezoneOffsetMs(utcGuess, DEFAULT_TIMEZONE);
    const corrected = new Date(utcGuess.getTime() - offset1);
    const offset2 = this.getTimezoneOffsetMs(corrected, DEFAULT_TIMEZONE);
    return offset2 === offset1 ? corrected : new Date(utcGuess.getTime() - offset2);
  }

  /** Offset of `timeZone` vs UTC at `instant`, in ms (e.g. +3600000 for CET). */
  private getTimezoneOffsetMs(instant: Date, timeZone: string): number {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(instant);

    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
    const asUtc = Date.UTC(
      get('year'),
      get('month') - 1,
      get('day'),
      get('hour') % 24,
      get('minute'),
      get('second'),
    );
    return asUtc - instant.getTime();
  }
}
