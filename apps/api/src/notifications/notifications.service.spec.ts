import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { createMockPrisma, createMockConfigService } from '../common/test-utils';
import { NOTIFICATION_TYPES } from './dto/update-preference.dto';

// Mock firebase-admin (v14 modular entry points)
const mockSendEachForMulticast = jest.fn();
jest.mock('firebase-admin/app', () => ({
  initializeApp: jest.fn(),
  cert: jest.fn().mockReturnValue({}),
}));
jest.mock('firebase-admin/messaging', () => ({
  getMessaging: jest.fn().mockReturnValue({
    sendEachForMulticast: (...args: unknown[]) => mockSendEachForMulticast(...args),
  }),
}));

import * as adminApp from 'firebase-admin/app';
const admin = { initializeApp: adminApp.initializeApp, credential: { cert: adminApp.cert } };

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
    beforeEach(() => {
      prisma.pushToken.findMany.mockResolvedValue([]);
      prisma.pushToken.deleteMany.mockResolvedValue({ count: 0 });
      prisma.pushToken.upsert.mockResolvedValue({
        userId: 'user-1',
        token: 'tok',
        platform: 'web',
      });
    });

    it('should upsert push token', async () => {
      const result = await service.registerToken('user-1', { token: 'tok', platform: 'web' });

      expect(result).toBeDefined();
      expect(prisma.pushToken.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_token: { userId: 'user-1', token: 'tok' } },
        }),
      );
    });

    it('should touch updatedAt on re-registration so the device counts as recently used', async () => {
      await service.registerToken('user-1', { token: 'tok', platform: 'android' });

      expect(prisma.pushToken.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: { platform: 'android', updatedAt: expect.any(Date) },
        }),
      );
    });

    it('should evict the least recently used token, not the oldest one', async () => {
      prisma.pushToken.findMany.mockResolvedValue([{ id: 'least-recently-used' }]);
      prisma.pushToken.deleteMany.mockResolvedValue({ count: 1 });

      await service.registerToken('user-1', { token: 'new-tok', platform: 'web' });

      // LRU by updatedAt, never FIFO by createdAt: the phone used every day keeps
      // its slot even when it was the first one registered.
      expect(prisma.pushToken.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { updatedAt: 'desc' },
        skip: 10,
        select: { id: true },
      });
      expect(prisma.pushToken.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['least-recently-used'] } },
      });
    });

    it('should not evict anything when under max capacity', async () => {
      await service.registerToken('user-1', { token: 'tok', platform: 'web' });

      expect(prisma.pushToken.deleteMany).not.toHaveBeenCalled();
    });

    it('should prune after the upsert so the token just registered is never the victim', async () => {
      const callOrder: string[] = [];
      prisma.pushToken.upsert.mockImplementation(async () => {
        callOrder.push('upsert');
        return { userId: 'user-1', token: 'tok', platform: 'web' };
      });
      prisma.pushToken.findMany.mockImplementation(async () => {
        callOrder.push('findMany');
        return [];
      });

      await service.registerToken('user-1', { token: 'tok', platform: 'web' });

      expect(callOrder).toEqual(['upsert', 'findMany']);
    });

    it('should not read the token back before upserting (no count/findUnique race)', async () => {
      await service.registerToken('user-1', { token: 'tok', platform: 'web' });

      expect(prisma.pushToken.count).not.toHaveBeenCalled();
      expect(prisma.pushToken.findUnique).not.toHaveBeenCalled();
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
    it('should return every notification type with defaults', async () => {
      prisma.notificationPreference.findMany.mockResolvedValue([]);

      const result = await service.getPreferences('user-1');

      expect(result).toHaveLength(NOTIFICATION_TYPES.length);
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

  // Web push duplicates bug: @firebase/messaging shows its own notification whenever the
  // FCM payload carries a top-level `notification` AND onBackgroundMessage also fires — it
  // is not either/or. Our SW's onBackgroundMessage already shows the right one (routing +
  // action buttons), so the SDK's copy is a duplicate. Fix: web tokens get a data-only
  // payload (no `notification`, no `webpush.notification`), title/body travel inside
  // `data` instead. Android tokens are unaffected — same payload shape as before.
  describe('sendToTokens — platform-split payloads (web push duplicates fix)', () => {
    it('should send a data-only message for web tokens: no notification key, title/body folded into data', async () => {
      service.onModuleInit();
      prisma.pushToken.findMany.mockResolvedValue([{ token: 'web-token', platform: 'web' }]);
      mockSendEachForMulticast.mockResolvedValue({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true }],
      });

      await service.sendToUser('user-1', 'Title', 'Body', { type: 'new_event' });

      expect(mockSendEachForMulticast).toHaveBeenCalledTimes(1);
      const [[calledMessage]] = mockSendEachForMulticast.mock.calls;
      expect(calledMessage).toEqual(
        expect.objectContaining({
          tokens: ['web-token'],
          data: { type: 'new_event', title: 'Title', body: 'Body' },
        }),
      );
      expect(calledMessage).not.toHaveProperty('notification');
      expect(calledMessage).not.toHaveProperty('webpush');
    });

    it('should keep the current notification + android block for android tokens, unchanged', async () => {
      service.onModuleInit();
      prisma.pushToken.findMany.mockResolvedValue([
        { token: 'android-token', platform: 'android' },
      ]);
      mockSendEachForMulticast.mockResolvedValue({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true }],
      });

      await service.sendToUser('user-1', 'Title', 'Body', { type: 'new_event' });

      expect(mockSendEachForMulticast).toHaveBeenCalledTimes(1);
      expect(mockSendEachForMulticast).toHaveBeenCalledWith(
        expect.objectContaining({
          tokens: ['android-token'],
          notification: { title: 'Title', body: 'Body' },
          data: { type: 'new_event' },
          android: {
            notification: {
              channelId: 'default',
              icon: 'ic_launcher',
            },
          },
        }),
      );
    });

    it('should issue two separate multicast sends when tokens span both platforms', async () => {
      service.onModuleInit();
      prisma.pushToken.findMany.mockResolvedValue([
        { token: 'android-token', platform: 'android' },
        { token: 'web-token', platform: 'web' },
      ]);
      mockSendEachForMulticast.mockImplementation((message: { tokens: string[] }) => ({
        successCount: message.tokens.length,
        failureCount: 0,
        responses: message.tokens.map(() => ({ success: true })),
      }));

      await service.sendToUser('user-1', 'Title', 'Body');

      expect(mockSendEachForMulticast).toHaveBeenCalledTimes(2);
      const calls = mockSendEachForMulticast.mock.calls.map(
        ([message]: [
          { tokens: string[]; notification?: unknown; data?: Record<string, string> },
        ]) => message,
      );
      const androidCall = calls.find((c: { tokens: string[] }) =>
        c.tokens.includes('android-token'),
      );
      const webCall = calls.find((c: { tokens: string[] }) => c.tokens.includes('web-token'));

      expect(androidCall).toEqual(
        expect.objectContaining({ notification: { title: 'Title', body: 'Body' } }),
      );
      expect(webCall).not.toHaveProperty('notification');
      expect(webCall?.data).toEqual({ title: 'Title', body: 'Body' });
    });

    it('should send a single multicast call for web-only tokens (no notification key)', async () => {
      service.onModuleInit();
      prisma.pushToken.findMany.mockResolvedValue([
        { token: 'web-token-1', platform: 'web' },
        { token: 'web-token-2', platform: 'web' },
      ]);
      mockSendEachForMulticast.mockResolvedValue({
        successCount: 2,
        failureCount: 0,
        responses: [{ success: true }, { success: true }],
      });

      await service.sendToUser('user-1', 'Title', 'Body');

      expect(mockSendEachForMulticast).toHaveBeenCalledTimes(1);
      const [[calledMessage]] = mockSendEachForMulticast.mock.calls;
      expect(calledMessage.tokens).toEqual(['web-token-1', 'web-token-2']);
      expect(calledMessage).not.toHaveProperty('notification');
    });

    it('should send a single multicast call for android-only tokens, as today', async () => {
      service.onModuleInit();
      prisma.pushToken.findMany.mockResolvedValue([
        { token: 'android-token-1', platform: 'android' },
        { token: 'android-token-2', platform: 'android' },
      ]);
      mockSendEachForMulticast.mockResolvedValue({
        successCount: 2,
        failureCount: 0,
        responses: [{ success: true }, { success: true }],
      });

      await service.sendToUser('user-1', 'Title', 'Body');

      expect(mockSendEachForMulticast).toHaveBeenCalledTimes(1);
      expect(mockSendEachForMulticast).toHaveBeenCalledWith(
        expect.objectContaining({ notification: { title: 'Title', body: 'Body' } }),
      );
    });

    it('should aggregate sent/failed counts across both platform batches', async () => {
      service.onModuleInit();
      prisma.pushToken.findMany.mockResolvedValue([
        { token: 'android-token', platform: 'android' },
        { token: 'web-token-1', platform: 'web' },
        { token: 'web-token-2', platform: 'web' },
      ]);
      prisma.notificationLog.create.mockResolvedValue({});
      // Dispatch per-batch by token identity, not call order — the aggregation must be
      // correct regardless of which batch (android/web) is sent first.
      mockSendEachForMulticast.mockImplementation((message: { tokens: string[] }) => {
        if (message.tokens.includes('android-token')) {
          return { successCount: 1, failureCount: 0, responses: [{ success: true }] };
        }
        return {
          successCount: 1,
          failureCount: 1,
          responses: [
            { success: true },
            {
              success: false,
              error: { code: 'messaging/internal-error', message: 'transient' },
            },
          ],
        };
      });

      await service.sendToUser('user-1', 'Title', 'Body');

      expect(prisma.notificationLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tokenCount: 3,
          sentCount: 2,
          failedCount: 1,
        }),
      });
    });

    it('should clean up invalid tokens independently per platform batch (by-batch response indices)', async () => {
      service.onModuleInit();
      prisma.pushToken.findMany.mockResolvedValue([
        { token: 'android-valid', platform: 'android' },
        { token: 'android-invalid', platform: 'android' },
        { token: 'web-valid', platform: 'web' },
        { token: 'web-invalid', platform: 'web' },
      ]);
      prisma.pushToken.deleteMany.mockResolvedValue({ count: 1 });
      // Each batch's response.responses is indexed against THAT batch's own tokens array
      // (['android-valid','android-invalid'] or ['web-valid','web-invalid']), never against
      // the combined 4-token list. A batch-index bug would delete the wrong token.
      mockSendEachForMulticast.mockImplementation((message: { tokens: string[] }) => {
        const isAndroidBatch = message.tokens.includes('android-valid');
        const errorCode = isAndroidBatch
          ? 'messaging/registration-token-not-registered'
          : 'messaging/invalid-registration-token';
        return {
          successCount: 1,
          failureCount: 1,
          responses: [
            { success: true },
            { success: false, error: { code: errorCode, message: 'gone' } },
          ],
        };
      });

      await service.sendToUser('user-1', 'Title', 'Body');

      expect(prisma.pushToken.deleteMany).toHaveBeenCalledWith({
        where: { token: { in: ['android-invalid'] } },
      });
      expect(prisma.pushToken.deleteMany).toHaveBeenCalledWith({
        where: { token: { in: ['web-invalid'] } },
      });
    });

    it('should treat a token with no recognized platform as native (android-style payload), not data-only', async () => {
      // Defensive default: an unexpected/missing platform value must degrade to today's
      // behavior (full payload) rather than silently becoming a silent data-only push.
      service.onModuleInit();
      prisma.pushToken.findMany.mockResolvedValue([{ token: 'unknown-platform-token' }]);
      mockSendEachForMulticast.mockResolvedValue({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true }],
      });

      await service.sendToUser('user-1', 'Title', 'Body');

      expect(mockSendEachForMulticast).toHaveBeenCalledTimes(1);
      expect(mockSendEachForMulticast).toHaveBeenCalledWith(
        expect.objectContaining({
          notification: { title: 'Title', body: 'Body' },
        }),
      );
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
      expect(result.preferences).toHaveLength(NOTIFICATION_TYPES.length);
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
