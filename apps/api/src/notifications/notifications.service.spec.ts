import { Logger } from '@nestjs/common';
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

    it('should fall back to the raw PEM when the key is not base64', () => {
      const rawPemWithEscapes =
        '-----BEGIN PRIVATE KEY-----\\nMIIBfake\\n-----END PRIVATE KEY-----\\n';
      const config = createMockConfigService({ FIREBASE_PRIVATE_KEY: rawPemWithEscapes });
      const svc = new NotificationsService(
        prisma as unknown as PrismaService,
        config as unknown as ConfigService,
      );

      svc.onModuleInit();

      expect(admin.credential.cert).toHaveBeenCalledWith(
        expect.objectContaining({
          privateKey: '-----BEGIN PRIVATE KEY-----\nMIIBfake\n-----END PRIVATE KEY-----\n',
        }),
      );
      expect(admin.initializeApp).toHaveBeenCalledTimes(1);
      expect(svc.isFirebaseInitialized()).toBe(true);
    });

    it('should log an error and stay uninitialized when the key is not a valid PEM', () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      const config = createMockConfigService({
        FIREBASE_PRIVATE_KEY: Buffer.from('not-a-key').toString('base64'),
      });
      const svc = new NotificationsService(
        prisma as unknown as PrismaService,
        config as unknown as ConfigService,
      );

      svc.onModuleInit();

      expect(admin.initializeApp).not.toHaveBeenCalled();
      expect(svc.isFirebaseInitialized()).toBe(false);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('FIREBASE_PRIVATE_KEY'));
      errorSpy.mockRestore();
    });

    it('should report initialized after a successful init with a base64 key', () => {
      service.onModuleInit();

      expect(service.isFirebaseInitialized()).toBe(true);
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

    it('should create a notification log after successful send', async () => {
      service.onModuleInit();
      prisma.pushToken.findMany.mockResolvedValue([{ token: 'tok-1' }, { token: 'tok-2' }]);
      prisma.notificationLog.create.mockResolvedValue({});
      mockSendEachForMulticast.mockResolvedValue({
        successCount: 2,
        failureCount: 0,
        responses: [{ success: true }, { success: true }],
      });

      await service.sendToUser('user-1', 'Hello', 'World', { screen: 'home' }, 'new_event');

      expect(prisma.notificationLog.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          type: 'new_event',
          title: 'Hello',
          body: 'World',
          data: { screen: 'home' },
          tokenCount: 2,
          sentCount: 2,
          failedCount: 0,
        },
      });
    });

    it('should create a notification log with failure counts', async () => {
      service.onModuleInit();
      prisma.pushToken.findMany.mockResolvedValue([{ token: 'valid' }, { token: 'invalid' }]);
      prisma.notificationLog.create.mockResolvedValue({});
      prisma.pushToken.deleteMany.mockResolvedValue({ count: 1 });
      mockSendEachForMulticast.mockResolvedValue({
        successCount: 1,
        failureCount: 1,
        responses: [
          { success: true },
          {
            success: false,
            error: { code: 'messaging/registration-token-not-registered', message: 'Invalid' },
          },
        ],
      });

      await service.sendToUser('user-1', 'Title', 'Body');

      expect(prisma.notificationLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          tokenCount: 2,
          sentCount: 1,
          failedCount: 1,
        }),
      });
    });

    it('should not create a log when there are no tokens', async () => {
      prisma.pushToken.findMany.mockResolvedValue([]);

      await service.sendToUser('user-1', 'Title', 'Body');

      expect(prisma.notificationLog.create).not.toHaveBeenCalled();
    });

    it('should not create a log when notification type is disabled', async () => {
      prisma.notificationPreference.findUnique.mockResolvedValue({ enabled: false });

      await service.sendToUser('user-1', 'Title', 'Body', undefined, 'new_event');

      expect(prisma.notificationLog.create).not.toHaveBeenCalled();
    });
  });

  describe('sendTestNotification', () => {
    it('should send a test notification to the requesting user', async () => {
      service.onModuleInit();
      prisma.pushToken.findMany.mockResolvedValue([{ token: 'tok-1' }]);
      prisma.notificationLog.create.mockResolvedValue({});
      mockSendEachForMulticast.mockResolvedValue({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true }],
      });

      const result = await service.sendTestNotification('user-1', {});

      expect(result).toEqual({ sent: 1 });
      expect(prisma.pushToken.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
    });

    it('should use custom title and body when provided', async () => {
      service.onModuleInit();
      prisma.pushToken.findMany.mockResolvedValue([{ token: 'tok-1' }]);
      prisma.notificationLog.create.mockResolvedValue({});
      mockSendEachForMulticast.mockResolvedValue({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true }],
      });

      await service.sendTestNotification('user-1', {
        title: 'Custom Title',
        body: 'Custom Body',
      });

      expect(mockSendEachForMulticast).toHaveBeenCalledWith(
        expect.objectContaining({
          notification: { title: 'Custom Title', body: 'Custom Body' },
        }),
      );
    });

    it('should use default title and body when not provided', async () => {
      service.onModuleInit();
      prisma.pushToken.findMany.mockResolvedValue([{ token: 'tok-1' }]);
      prisma.notificationLog.create.mockResolvedValue({});
      mockSendEachForMulticast.mockResolvedValue({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true }],
      });

      await service.sendTestNotification('user-1', {});

      expect(mockSendEachForMulticast).toHaveBeenCalledWith(
        expect.objectContaining({
          notification: {
            title: 'Test notification',
            body: 'If you see this, notifications are working!',
          },
        }),
      );
    });

    it('should return sent 0 when user has no tokens', async () => {
      prisma.pushToken.findMany.mockResolvedValue([]);

      const result = await service.sendTestNotification('user-1', {});

      expect(result).toEqual({ sent: 0 });
    });

    it('should persist test logs with a test-prefixed type', async () => {
      service.onModuleInit();
      prisma.pushToken.findMany.mockResolvedValue([{ token: 'tok-1' }]);
      prisma.notificationLog.create.mockResolvedValue({});
      mockSendEachForMulticast.mockResolvedValue({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true }],
      });

      await service.sendTestNotification('user-1', { type: 'new_event' });

      expect(prisma.notificationLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ type: 'test:new_event' }),
      });
    });

    it("should persist type 'test' when no type is provided", async () => {
      service.onModuleInit();
      prisma.pushToken.findMany.mockResolvedValue([{ token: 'tok-1' }]);
      prisma.notificationLog.create.mockResolvedValue({});
      mockSendEachForMulticast.mockResolvedValue({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true }],
      });

      await service.sendTestNotification('user-1', {});

      expect(prisma.notificationLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ type: 'test' }),
      });
    });
  });

  describe('getDebugInfo', () => {
    it('should return tokens, preferences, and recent logs for the user', async () => {
      const tokens = [
        {
          id: 'pt-1',
          userId: 'user-1',
          token: 'tok-1',
          platform: 'android',
          createdAt: new Date(),
        },
      ];
      const logs = [
        {
          id: 'log-1',
          userId: 'user-1',
          type: 'new_event',
          title: 'Test',
          body: 'Body',
          data: null,
          tokenCount: 1,
          sentCount: 1,
          failedCount: 0,
          createdAt: new Date(),
        },
      ];
      prisma.pushToken.findMany.mockResolvedValue(tokens);
      prisma.notificationPreference.findMany.mockResolvedValue([]);
      prisma.notificationLog.findMany.mockResolvedValue(logs);

      const result = await service.getDebugInfo('user-1');

      expect(result.tokens).toEqual(tokens);
      expect(result.preferences).toHaveLength(16);
      expect(result.recentLogs).toEqual(logs);
    });

    it('should limit recent logs to 20', async () => {
      prisma.pushToken.findMany.mockResolvedValue([]);
      prisma.notificationPreference.findMany.mockResolvedValue([]);
      prisma.notificationLog.findMany.mockResolvedValue([]);

      await service.getDebugInfo('user-1');

      expect(prisma.notificationLog.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
    });

    it('should only query data for the specified user', async () => {
      prisma.pushToken.findMany.mockResolvedValue([]);
      prisma.notificationPreference.findMany.mockResolvedValue([]);
      prisma.notificationLog.findMany.mockResolvedValue([]);

      await service.getDebugInfo('user-1');

      expect(prisma.pushToken.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(prisma.notificationPreference.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(prisma.notificationLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1' } }),
      );
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
