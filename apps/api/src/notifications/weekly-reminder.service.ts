import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from './notifications.service';

/**
 * Group timezone. The reminder is about the week the user sees on their calendar, so
 * both the hour it fires and the Monday-to-Sunday range it asks about are Madrid's.
 * v0.1 hardcodes it, like the event reminders and the poll copy.
 */
const DEFAULT_TIMEZONE = 'Europe/Madrid';

@Injectable()
export class WeeklyReminderService {
  private readonly logger = new Logger(WeeklyReminderService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  // NOTE: Cron jobs assume single-instance deployment. For horizontal scaling,
  // use a distributed lock (e.g., PostgreSQL advisory locks) or a job queue.
  // Without an explicit timeZone the expression is read in the container's zone, and the
  // Dockerfile sets none: the "Sunday evening" reminder drifted with UTC.
  @Cron('0 20 * * 0', { timeZone: DEFAULT_TIMEZONE }) // Sunday 20:00 in Madrid
  async sendWeeklyReminders() {
    const { nextMonday, nextSunday } = this.getNextWeekRange();

    // Get all unique user IDs that are members of at least one group
    const members = await this.prisma.groupMember.findMany({
      select: { userId: true },
    });
    const allUserIds = [...new Set(members.map((m) => m.userId))];

    if (allUserIds.length === 0) return;

    // Find users who already have availability for next week
    const usersWithAvailability = await this.prisma.availability.findMany({
      where: {
        date: { gte: nextMonday, lte: nextSunday },
        userId: { in: allUserIds },
      },
      select: { userId: true },
    });
    const hasAvailabilitySet = new Set(usersWithAvailability.map((a) => a.userId));

    // Users without any availability for next week
    const usersToNotify = allUserIds.filter((id) => !hasAvailabilitySet.has(id));

    if (usersToNotify.length === 0) {
      this.logger.debug('All users have availability for next week');
      return;
    }

    this.logger.debug(
      `Sending weekly reminders to ${usersToNotify.length} user(s) without availability`,
    );

    // Process in batches to avoid exhausting the database connection pool
    const BATCH_SIZE = 10;
    for (let i = 0; i < usersToNotify.length; i += BATCH_SIZE) {
      const batch = usersToNotify.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((userId) =>
          this.notificationsService.sendToUser(userId, 'weekly_availability_reminder', {}),
        ),
      );

      for (const result of results) {
        if (result.status === 'rejected') {
          this.logger.error('Failed to send weekly reminder', result.reason);
        }
      }
    }
  }

  /**
   * Next Monday to next Sunday, both as the UTC-midnight instants the `@db.Date` columns
   * are stored at. The day the count starts from is the Madrid civil day: reading the UTC
   * one moves the boundary by an hour or two and, right after midnight in Madrid, offered
   * the week that had already started.
   */
  getNextWeekRange(now: Date = new Date()): { nextMonday: Date; nextSunday: Date } {
    const today = this.startOfTodayInMadrid(now);
    const dayOfWeek = today.getUTCDay(); // 0 = Sunday
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;

    const nextMonday = new Date(today);
    nextMonday.setUTCDate(today.getUTCDate() + daysUntilMonday);

    const nextSunday = new Date(nextMonday);
    nextSunday.setUTCDate(nextMonday.getUTCDate() + 6);
    nextSunday.setUTCHours(23, 59, 59, 999);

    return { nextMonday, nextSunday };
  }

  /** Today's civil date in Madrid, as a UTC-midnight `Date`. */
  private startOfTodayInMadrid(now: Date): Date {
    const [year, month, day] = new Intl.DateTimeFormat('en-CA', {
      timeZone: DEFAULT_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .format(now)
      .split('-')
      .map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }
}
