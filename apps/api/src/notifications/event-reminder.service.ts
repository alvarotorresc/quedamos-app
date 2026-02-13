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
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Find events happening in the next 24 hours that haven't been cancelled
    const events = await this.prisma.event.findMany({
      where: {
        date: {
          gte: now,
          lte: in24h,
        },
        status: { not: 'cancelled' },
      },
      include: {
        attendees: {
          where: { status: 'pending' },
        },
        group: true,
      },
    });

    if (events.length === 0) return;

    this.logger.debug(`Found ${events.length} event(s) in next 24h`);

    for (const event of events) {
      const pendingUserIds = event.attendees.map((a) => a.userId);
      if (pendingUserIds.length === 0) continue;

      for (const userId of pendingUserIds) {
        const enabled = await this.notificationsService.isNotificationEnabled(
          userId,
          'new_event',
        );
        if (!enabled) continue;

        this.notificationsService
          .sendToUser(userId, 'Recordatorio', `"${event.title}" es mañana`, {
            type: 'event_reminder',
            eventId: event.id,
            groupId: event.groupId,
          })
          .catch(() => {});
      }

      this.logger.debug(
        `Sent reminders for "${event.title}" to ${pendingUserIds.length} pending attendee(s)`,
      );
    }
  }
}
