import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma/prisma.service';

/**
 * How long a notice stays in the bandeja. Two months is far past the point where
 * anybody scrolls back to a quedada that already happened, and it keeps the table
 * bounded without anybody having to prune it by hand.
 */
export const INBOX_RETENTION_DAYS = 60;

/** Same zone as the rest of the crons: the quiet hour is Madrid's, not the container's. */
const DEFAULT_TIMEZONE = 'Europe/Madrid';

@Injectable()
export class NotificationRetentionService {
  private readonly logger = new Logger(NotificationRetentionService.name);

  constructor(private prisma: PrismaService) {}

  // NOTE: Cron jobs assume single-instance deployment. For horizontal scaling,
  // use a distributed lock (e.g., PostgreSQL advisory locks) or a job queue.
  // A second instance would only delete rows the first already deleted, so this one
  // is harmless to run twice — unlike the reminders, which would double-send.
  @Cron('0 4 * * *', { timeZone: DEFAULT_TIMEZONE }) // every day at 04:00 in Madrid
  async purgeOldNotifications(): Promise<void> {
    const cutoff = new Date(Date.now() - INBOX_RETENTION_DAYS * 24 * 60 * 60 * 1000);

    try {
      const { count } = await this.prisma.notification.deleteMany({
        where: { createdAt: { lt: cutoff } },
      });

      if (count > 0) {
        this.logger.log(`Purged ${count} notification(s) older than ${INBOX_RETENTION_DAYS} days`);
      }
    } catch (error) {
      // Housekeeping must never take the scheduler down with it.
      this.logger.error('Failed to purge old notifications', error);
    }
  }
}
