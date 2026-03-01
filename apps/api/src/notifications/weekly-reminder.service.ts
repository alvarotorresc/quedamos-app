import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from './notifications.service';

@Injectable()
export class WeeklyReminderService {
  private readonly logger = new Logger(WeeklyReminderService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  @Cron('0 20 * * 0') // Sunday 20:00 UTC
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

    for (const userId of usersToNotify) {
      this.notificationsService
        .sendToUser(
          userId,
          'Marca tu disponibilidad',
          'Todavía no has marcado disponibilidad para la semana que viene',
          { type: 'weekly_availability_reminder' },
          'weekly_availability_reminder',
        )
        .catch((err) =>
          this.logger.error(`Failed to send weekly reminder to user ${userId}`, err),
        );
    }
  }

  getNextWeekRange(): { nextMonday: Date; nextSunday: Date } {
    const now = new Date();
    const dayOfWeek = now.getUTCDay(); // 0 = Sunday
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;

    const nextMonday = new Date(now);
    nextMonday.setUTCDate(now.getUTCDate() + daysUntilMonday);
    nextMonday.setUTCHours(0, 0, 0, 0);

    const nextSunday = new Date(nextMonday);
    nextSunday.setUTCDate(nextMonday.getUTCDate() + 6);
    nextSunday.setUTCHours(23, 59, 59, 999);

    return { nextMonday, nextSunday };
  }
}
