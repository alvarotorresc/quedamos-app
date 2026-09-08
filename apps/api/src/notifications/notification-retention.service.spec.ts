import { Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { createMockPrisma } from '../common/test-utils';
import {
  INBOX_RETENTION_DAYS,
  NotificationRetentionService,
} from './notification-retention.service';

describe('NotificationRetentionService', () => {
  let service: NotificationRetentionService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    prisma = createMockPrisma();
    service = new NotificationRetentionService(prisma as unknown as PrismaService);
  });

  it('should delete notices older than the retention window', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-08T04:00:00Z'));
    prisma.notification.deleteMany.mockResolvedValue({ count: 7 });

    await service.purgeOldNotifications();

    const [[args]] = prisma.notification.deleteMany.mock.calls;
    const cutoff = args.where.createdAt.lt as Date;
    expect(new Date('2026-09-08T04:00:00Z').getTime() - cutoff.getTime()).toBe(
      INBOX_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );

    jest.useRealTimers();
  });

  it('should keep the retention window at 60 days', () => {
    expect(INBOX_RETENTION_DAYS).toBe(60);
  });

  it('should say nothing when there was nothing to delete', async () => {
    prisma.notification.deleteMany.mockResolvedValue({ count: 0 });

    await service.purgeOldNotifications();

    expect(Logger.prototype.log).not.toHaveBeenCalled();
  });

  it('should report how many it deleted', async () => {
    prisma.notification.deleteMany.mockResolvedValue({ count: 3 });

    await service.purgeOldNotifications();

    expect(Logger.prototype.log).toHaveBeenCalledWith(expect.stringContaining('3'));
  });

  it('should swallow a failure instead of taking the scheduler down', async () => {
    prisma.notification.deleteMany.mockRejectedValue(new Error('db down'));

    await expect(service.purgeOldNotifications()).resolves.toBeUndefined();
    expect(Logger.prototype.error).toHaveBeenCalled();
  });
});
