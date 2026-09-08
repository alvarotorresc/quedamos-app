import { Test, TestingModule } from '@nestjs/testing';
import { WidgetRefreshService } from './widget-refresh.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { createMockPrisma, MockPrisma } from '../common/test-utils';

const mockSendEachForMulticast = jest.fn();
const mockGetApps = jest.fn();

jest.mock('firebase-admin/app', () => ({
  getApps: () => mockGetApps(),
}));
jest.mock('firebase-admin/messaging', () => ({
  getMessaging: () => ({
    sendEachForMulticast: (...args: unknown[]) => mockSendEachForMulticast(...args),
  }),
}));

const GROUP = 'group-1';
const ANA = 'user-ana';
const BEA = 'user-bea';
const CARLOS = 'user-carlos';

function ok(count: number) {
  return {
    successCount: count,
    failureCount: 0,
    responses: Array.from({ length: count }, () => ({ success: true })),
  };
}

describe('WidgetRefreshService', () => {
  let service: WidgetRefreshService;
  let prisma: MockPrisma;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-08T10:00:00.000Z'));

    mockGetApps.mockReturnValue([{ name: '[DEFAULT]' }]);
    mockSendEachForMulticast.mockResolvedValue(ok(1));

    prisma = createMockPrisma();
    prisma.groupMember.findMany.mockResolvedValue([
      { userId: ANA },
      { userId: BEA },
      { userId: CARLOS },
    ]);
    prisma.pushToken.findMany.mockResolvedValue([
      { userId: BEA, token: 'token-bea' },
      { userId: CARLOS, token: 'token-carlos' },
    ]);
    prisma.pushToken.deleteMany.mockResolvedValue({ count: 0 });

    const module: TestingModule = await Test.createTestingModule({
      providers: [WidgetRefreshService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<WidgetRefreshService>(WidgetRefreshService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('the message it sends', () => {
    it('is data-only, high priority, and carries the group it is about', async () => {
      await service.notifyGroupWidgets(GROUP, ANA);

      expect(mockSendEachForMulticast).toHaveBeenCalledTimes(1);
      const message = mockSendEachForMulticast.mock.calls[0][0];
      expect(message).toEqual({
        tokens: ['token-bea', 'token-carlos'],
        data: { type: 'widget_refresh', groupId: GROUP },
        android: { priority: 'high' },
      });
      // A `notification` block would draw something in the tray: this push is
      // machinery, the user must never see it.
      expect(message.notification).toBeUndefined();
    });

    it('only asks for the android tokens — a browser has no widgets', async () => {
      await service.notifyGroupWidgets(GROUP, ANA);

      expect(prisma.pushToken.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ platform: 'android' }),
        }),
      );
    });

    it('leaves out the member who made the change: their own app already refreshed', async () => {
      await service.notifyGroupWidgets(GROUP, ANA);

      const where = prisma.pushToken.findMany.mock.calls[0][0].where;
      expect(where.userId.in).toEqual([BEA, CARLOS]);
    });

    it('reaches the whole group when no actor is given (a cron, a cascade)', async () => {
      await service.notifyGroupWidgets(GROUP);

      const where = prisma.pushToken.findMany.mock.calls[0][0].where;
      expect(where.userId.in).toEqual([ANA, BEA, CARLOS]);
    });
  });

  describe('the throttle', () => {
    it('sends at most one push per user per minute', async () => {
      await service.notifyGroupWidgets(GROUP, ANA);
      expect(mockSendEachForMulticast).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(59_000);
      await service.notifyGroupWidgets(GROUP, ANA);

      expect(mockSendEachForMulticast).toHaveBeenCalledTimes(1);
      // Nothing to send: it must not even reach the token query a second time.
      expect(prisma.pushToken.findMany).toHaveBeenCalledTimes(1);
    });

    it('lets the next minute through', async () => {
      await service.notifyGroupWidgets(GROUP, ANA);

      jest.advanceTimersByTime(60_000);
      await service.notifyGroupWidgets(GROUP, ANA);

      expect(mockSendEachForMulticast).toHaveBeenCalledTimes(2);
    });

    it('is per user: a member silenced a second ago does not silence the others', async () => {
      prisma.pushToken.findMany.mockResolvedValueOnce([{ userId: BEA, token: 'token-bea' }]);
      await service.notifyGroupWidgets(GROUP, ANA);

      jest.advanceTimersByTime(10_000);
      prisma.pushToken.findMany.mockResolvedValueOnce([{ userId: CARLOS, token: 'token-carlos' }]);
      await service.notifyGroupWidgets(GROUP, ANA);

      expect(prisma.pushToken.findMany.mock.calls[1][0].where.userId.in).toEqual([CARLOS]);
      expect(mockSendEachForMulticast).toHaveBeenCalledTimes(2);
    });

    it('does not grow without bound: expired windows are forgotten', async () => {
      await service.notifyGroupWidgets(GROUP, ANA);
      jest.advanceTimersByTime(60_000);
      await service.notifyGroupWidgets(GROUP, ANA);

      // Two members were pushed to twice, and only their two windows are still held.
      expect(service.throttleSize()).toBe(2);
    });
  });

  describe('when there is nothing to do', () => {
    it('sends nothing when Firebase was never initialized', async () => {
      mockGetApps.mockReturnValue([]);

      await service.notifyGroupWidgets(GROUP, ANA);

      expect(prisma.groupMember.findMany).not.toHaveBeenCalled();
      expect(mockSendEachForMulticast).not.toHaveBeenCalled();
    });

    it('sends nothing when the actor is the only member', async () => {
      prisma.groupMember.findMany.mockResolvedValue([{ userId: ANA }]);

      await service.notifyGroupWidgets(GROUP, ANA);

      expect(prisma.pushToken.findMany).not.toHaveBeenCalled();
      expect(mockSendEachForMulticast).not.toHaveBeenCalled();
    });

    it('sends nothing when nobody else is on Android', async () => {
      prisma.pushToken.findMany.mockResolvedValue([]);

      await service.notifyGroupWidgets(GROUP, ANA);

      expect(mockSendEachForMulticast).not.toHaveBeenCalled();
    });
  });

  describe('invalid tokens', () => {
    it('deletes the ones FCM says no longer exist, and keeps the rest', async () => {
      mockSendEachForMulticast.mockResolvedValue({
        successCount: 1,
        failureCount: 1,
        responses: [
          { success: false, error: { code: 'messaging/registration-token-not-registered' } },
          { success: true },
        ],
      });

      await service.notifyGroupWidgets(GROUP, ANA);

      expect(prisma.pushToken.deleteMany).toHaveBeenCalledWith({
        where: { token: { in: ['token-bea'] } },
      });
    });

    it('leaves a token alone when the failure is not about the token', async () => {
      mockSendEachForMulticast.mockResolvedValue({
        successCount: 1,
        failureCount: 1,
        responses: [
          { success: false, error: { code: 'messaging/internal-error' } },
          { success: true },
        ],
      });

      await service.notifyGroupWidgets(GROUP, ANA);

      expect(prisma.pushToken.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('it never breaks the request that triggered it', () => {
    it('swallows an FCM failure', async () => {
      mockSendEachForMulticast.mockRejectedValue(new Error('FCM is down'));

      await expect(service.notifyGroupWidgets(GROUP, ANA)).resolves.toEqual({ sent: 0 });
    });

    it('swallows a database failure', async () => {
      prisma.groupMember.findMany.mockRejectedValue(new Error('connection lost'));

      await expect(service.notifyGroupWidgets(GROUP, ANA)).resolves.toEqual({ sent: 0 });
    });
  });
});
