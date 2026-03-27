import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { createMockPrisma, createMockConfigService } from '../common/test-utils';

// Mock firebase-admin
jest.mock('firebase-admin', () => {
  const mockSendEachForMulticast = jest.fn();
  return {
    initializeApp: jest.fn(),
    credential: {
      cert: jest.fn().mockReturnValue({}),
    },
    messaging: jest.fn().mockReturnValue({
      sendEachForMulticast: mockSendEachForMulticast,
    }),
    __mockSendEachForMulticast: mockSendEachForMulticast,
  };
});

import * as admin from 'firebase-admin';

const mockSendEachForMulticast = (admin as unknown as { __mockSendEachForMulticast: jest.Mock })
  .__mockSendEachForMulticast;

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let configService: ReturnType<typeof createMockConfigService>;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = createMockPrisma();
    configService = createMockConfigService();
    service = new NotificationsService(
      prisma as unknown as PrismaService,
      configService as unknown as ConfigService,
    );
  });

  describe('onModuleInit', () => {
    it('should initialize Firebase when credentials are configured', () => {
      service.onModuleInit();

      expect(admin.initializeApp).toHaveBeenCalledTimes(1);
    });

    it('should not initialize Firebase when credentials are missing', () => {
      const emptyConfig = createMockConfigService({
        FIREBASE_PROJECT_ID: '',
        FIREBASE_CLIENT_EMAIL: '',
        FIREBASE_PRIVATE_KEY: '',
      });
      const svc = new NotificationsService(
        prisma as unknown as PrismaService,
        emptyConfig as unknown as ConfigService,
      );
      emptyConfig.get.mockReturnValue(undefined as unknown as string);

      svc.onModuleInit();

      expect(admin.initializeApp).not.toHaveBeenCalled();
    });
  });

  describe('registerToken', () => {
    it('should upsert push token', async () => {
      prisma.pushToken.count.mockResolvedValue(0);
      prisma.pushToken.upsert.mockResolvedValue({
        userId: 'user-1',
        token: 'tok',
        platform: 'web',
      });

      const result = await service.registerToken('user-1', { token: 'tok', platform: 'web' });

      expect(result).toBeDefined();
      expect(prisma.pushToken.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_token: { userId: 'user-1', token: 'tok' } },
        }),
      );
    });

    it('should evict oldest token when at max capacity', async () => {
      prisma.pushToken.count.mockResolvedValue(10);
      prisma.pushToken.findFirst.mockResolvedValue({ id: 'old-token-id', token: 'old' });
      prisma.pushToken.delete.mockResolvedValue({});
      prisma.pushToken.upsert.mockResolvedValue({
        userId: 'user-1',
        token: 'new-tok',
        platform: 'web',
      });

      await service.registerToken('user-1', { token: 'new-tok', platform: 'web' });

      expect(prisma.pushToken.findFirst).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'asc' },
      });
      expect(prisma.pushToken.delete).toHaveBeenCalledWith({
        where: { id: 'old-token-id' },
      });
      expect(prisma.pushToken.upsert).toHaveBeenCalled();
    });

    it('should not evict when under max capacity', async () => {
      prisma.pushToken.count.mockResolvedValue(5);
      prisma.pushToken.upsert.mockResolvedValue({
        userId: 'user-1',
        token: 'tok',
        platform: 'web',
      });

      await service.registerToken('user-1', { token: 'tok', platform: 'web' });

      expect(prisma.pushToken.findFirst).not.toHaveBeenCalled();
      expect(prisma.pushToken.delete).not.toHaveBeenCalled();
    });
  });

  describe('unregisterToken', () => {
    it('should delete push token', async () => {
      prisma.pushToken.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.unregisterToken('user-1', 'tok');

      expect(result).toEqual({ success: true });
    });
  });

  describe('getPreferences', () => {
    it('should return all 16 notification types with defaults', async () => {
      prisma.notificationPreference.findMany.mockResolvedValue([]);

      const result = await service.getPreferences('user-1');

      expect(result).toHaveLength(16);
      expect(result.every((p) => p.enabled === true)).toBe(true);
    });

    it('should respect saved preferences', async () => {
      prisma.notificationPreference.findMany.mockResolvedValue([
        { type: 'new_event', enabled: false },
      ]);

      const result = await service.getPreferences('user-1');

      const newEventPref = result.find((p) => p.type === 'new_event');
      expect(newEventPref?.enabled).toBe(false);
    });

    it('should include all notification type categories', async () => {
      prisma.notificationPreference.findMany.mockResolvedValue([]);

      const result = await service.getPreferences('user-1');
      const types = result.map((p) => p.type);

      expect(types).toContain('event_reminder');
      expect(types).toContain('new_proposal');
      expect(types).toContain('proposal_voted');
      expect(types).toContain('role_changed');
      expect(types).toContain('weekly_availability_reminder');
    });
  });

  describe('updatePreference', () => {
    it('should upsert preference', async () => {
      prisma.notificationPreference.upsert.mockResolvedValue({
        type: 'new_event',
        enabled: false,
      });

      const result = await service.updatePreference('user-1', {
        type: 'new_event',
        enabled: false,
      });

      expect(result).toBeDefined();
      expect(prisma.notificationPreference.upsert).toHaveBeenCalled();
    });
  });

  describe('isNotificationEnabled', () => {
    it('should return true by default', async () => {
      prisma.notificationPreference.findUnique.mockResolvedValue(null);

      const result = await service.isNotificationEnabled('user-1', 'new_event');

      expect(result).toBe(true);
    });

    it('should return saved preference', async () => {
      prisma.notificationPreference.findUnique.mockResolvedValue({ enabled: false });

      const result = await service.isNotificationEnabled('user-1', 'new_event');

      expect(result).toBe(false);
    });
  });

  describe('sendToUser', () => {
    it('should return sent 0 when no tokens', async () => {
      prisma.pushToken.findMany.mockResolvedValue([]);

      const result = await service.sendToUser('user-1', 'Title', 'Body');

      expect(result).toEqual({ sent: 0 });
    });

    it('should skip when notificationType is disabled', async () => {
      prisma.notificationPreference.findUnique.mockResolvedValue({ enabled: false });

      const result = await service.sendToUser('user-1', 'Title', 'Body', undefined, 'new_event');

      expect(result).toEqual({ sent: 0 });
      expect(prisma.pushToken.findMany).not.toHaveBeenCalled();
    });

    it('should proceed when notificationType is enabled', async () => {
      prisma.notificationPreference.findUnique.mockResolvedValue({ enabled: true });
      prisma.pushToken.findMany.mockResolvedValue([]);

      const result = await service.sendToUser('user-1', 'Title', 'Body', undefined, 'new_event');

      expect(result).toEqual({ sent: 0 });
      expect(prisma.pushToken.findMany).toHaveBeenCalled();
    });

    it('should send via FCM when Firebase is initialized', async () => {
      service.onModuleInit();
      prisma.pushToken.findMany.mockResolvedValue([{ token: 'fcm-token-123' }]);
      mockSendEachForMulticast.mockResolvedValue({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true }],
      });

      const result = await service.sendToUser('user-1', 'Title', 'Body', { type: 'test' });

      expect(result).toEqual({ sent: 1 });
      expect(mockSendEachForMulticast).toHaveBeenCalledWith(
        expect.objectContaining({
          tokens: ['fcm-token-123'],
          notification: { title: 'Title', body: 'Body' },
          data: { type: 'test' },
        }),
      );
    });

    it('should clean up invalid tokens on FCM error', async () => {
      service.onModuleInit();
      prisma.pushToken.findMany.mockResolvedValue([
        { token: 'valid-token' },
        { token: 'invalid-token' },
      ]);
      prisma.pushToken.deleteMany.mockResolvedValue({ count: 1 });
      mockSendEachForMulticast.mockResolvedValue({
        successCount: 1,
        failureCount: 1,
        responses: [
          { success: true },
          {
            success: false,
            error: {
              code: 'messaging/registration-token-not-registered',
              message: 'Token not registered',
            },
          },
        ],
      });

      const result = await service.sendToUser('user-1', 'Title', 'Body');

      expect(result).toEqual({ sent: 1 });
      expect(prisma.pushToken.deleteMany).toHaveBeenCalledWith({
        where: { token: { in: ['invalid-token'] } },
      });
    });

    it('should return sent 0 on FCM fatal error', async () => {
      service.onModuleInit();
      prisma.pushToken.findMany.mockResolvedValue([{ token: 'tok' }]);
      mockSendEachForMulticast.mockRejectedValue(new Error('FCM down'));

      const result = await service.sendToUser('user-1', 'Title', 'Body');

      expect(result).toEqual({ sent: 0 });
    });
  });

  describe('sendToGroup', () => {
    it('should exclude specified user', async () => {
      prisma.groupMember.findMany.mockResolvedValue([{ userId: 'user-1' }, { userId: 'user-2' }]);
      prisma.pushToken.findMany.mockResolvedValue([]);

      await service.sendToGroup('group-1', 'Title', 'Body', 'user-1');

      expect(prisma.pushToken.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: { in: ['user-2'] } },
        }),
      );
    });

    it('should return sent 0 when no members', async () => {
      prisma.groupMember.findMany.mockResolvedValue([]);

      const result = await service.sendToGroup('group-1', 'Title', 'Body');

      expect(result).toEqual({ sent: 0 });
    });

    it('should filter out users with disabled notificationType', async () => {
      prisma.groupMember.findMany.mockResolvedValue([
        { userId: 'user-1' },
        { userId: 'user-2' },
        { userId: 'user-3' },
      ]);
      prisma.notificationPreference.findMany.mockResolvedValue([
        { userId: 'user-2', type: 'new_event', enabled: false },
      ]);
      prisma.pushToken.findMany.mockResolvedValue([]);

      await service.sendToGroup('group-1', 'Title', 'Body', undefined, undefined, 'new_event');

      expect(prisma.pushToken.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: { in: ['user-1', 'user-3'] } },
        }),
      );
    });

    it('should not filter when notificationType is not provided', async () => {
      prisma.groupMember.findMany.mockResolvedValue([{ userId: 'user-1' }, { userId: 'user-2' }]);
      prisma.pushToken.findMany.mockResolvedValue([]);

      await service.sendToGroup('group-1', 'Title', 'Body');

      expect(prisma.notificationPreference.findMany).not.toHaveBeenCalled();
    });

    it('should apply both exclude and notificationType filter', async () => {
      prisma.groupMember.findMany.mockResolvedValue([
        { userId: 'user-1' },
        { userId: 'user-2' },
        { userId: 'user-3' },
      ]);
      prisma.notificationPreference.findMany.mockResolvedValue([
        { userId: 'user-2', type: 'new_event', enabled: false },
      ]);
      prisma.pushToken.findMany.mockResolvedValue([]);

      await service.sendToGroup('group-1', 'Title', 'Body', 'user-1', undefined, 'new_event');

      // user-1 excluded, user-2 disabled preference, only user-3 remains
      expect(prisma.pushToken.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: { in: ['user-3'] } },
        }),
      );
    });
  });

  describe('sendToEventAttendees', () => {
    it('should only send to confirmed attendees when statusFilter is confirmed', async () => {
      prisma.eventAttendee.findMany.mockResolvedValue([
        { userId: 'user-1', status: 'confirmed' },
        { userId: 'user-3', status: 'confirmed' },
      ]);
      prisma.pushToken.findMany.mockResolvedValue([]);

      await service.sendToEventAttendees(
        'event-1',
        'Title',
        'Body',
        'user-1',
        undefined,
        undefined,
        'confirmed',
      );

      expect(prisma.eventAttendee.findMany).toHaveBeenCalledWith({
        where: { eventId: 'event-1', status: 'confirmed' },
      });
      expect(prisma.pushToken.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: { in: ['user-3'] } },
        }),
      );
    });

    it('should send to ALL attendees when no statusFilter (cancel case)', async () => {
      prisma.eventAttendee.findMany.mockResolvedValue([
        { userId: 'user-1', status: 'confirmed' },
        { userId: 'user-2', status: 'declined' },
        { userId: 'user-3', status: 'pending' },
      ]);
      prisma.pushToken.findMany.mockResolvedValue([]);

      await service.sendToEventAttendees('event-1', 'Quedada cancelada', 'Body', 'user-1');

      expect(prisma.eventAttendee.findMany).toHaveBeenCalledWith({
        where: { eventId: 'event-1' },
      });
      expect(prisma.pushToken.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: { in: ['user-2', 'user-3'] } },
        }),
      );
    });

    it('should return sent 0 when no matching attendees', async () => {
      prisma.eventAttendee.findMany.mockResolvedValue([]);

      const result = await service.sendToEventAttendees('event-1', 'Title', 'Body');

      expect(result).toEqual({ sent: 0 });
    });

    it('should respect notification preferences', async () => {
      prisma.eventAttendee.findMany.mockResolvedValue([
        { userId: 'user-1', status: 'confirmed' },
        { userId: 'user-2', status: 'confirmed' },
      ]);
      prisma.notificationPreference.findMany.mockResolvedValue([
        { userId: 'user-2', type: 'event_updated', enabled: false },
      ]);
      prisma.pushToken.findMany.mockResolvedValue([]);

      await service.sendToEventAttendees(
        'event-1',
        'Title',
        'Body',
        undefined,
        undefined,
        'event_updated',
        'confirmed',
      );

      expect(prisma.pushToken.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: { in: ['user-1'] } },
        }),
      );
    });
  });
});
