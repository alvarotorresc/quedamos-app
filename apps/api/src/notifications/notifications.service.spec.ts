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

// Stand-ins for the tests that only care about tokens, batching and logging: the
// weekly reminder takes no params, new_event takes the two the copy interpolates.
const REMINDER_COPY = {
  title: 'Marca tu disponibilidad',
  body: 'Todavía no has marcado disponibilidad para la semana que viene',
};
const NEW_EVENT = { actorName: 'Ana', title: 'Cena' };
const NEW_EVENT_COPY = { title: 'Nueva quedada', body: 'Ana ha creado "Cena"' };

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let configService: ReturnType<typeof createMockConfigService>;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = createMockPrisma();
    // No opt-out rows by default: every send now resolves preferences for its type.
    prisma.notificationPreference.findMany.mockResolvedValue([]);
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

      const result = await service.sendToUser('user-1', 'weekly_availability_reminder', {});

      expect(result).toEqual({ sent: 0 });
    });

    it('should skip when notificationType is disabled', async () => {
      prisma.notificationPreference.findUnique.mockResolvedValue({ enabled: false });

      const result = await service.sendToUser('user-1', 'new_event', NEW_EVENT);

      expect(result).toEqual({ sent: 0 });
      expect(prisma.pushToken.findMany).not.toHaveBeenCalled();
    });

    it('should proceed when notificationType is enabled', async () => {
      prisma.notificationPreference.findUnique.mockResolvedValue({ enabled: true });
      prisma.pushToken.findMany.mockResolvedValue([]);

      const result = await service.sendToUser('user-1', 'new_event', NEW_EVENT);

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

      const result = await service.sendToUser('user-1', 'weekly_availability_reminder', {});

      expect(result).toEqual({ sent: 1 });
      expect(mockSendEachForMulticast).toHaveBeenCalledWith(
        expect.objectContaining({
          tokens: ['fcm-token-123'],
          notification: REMINDER_COPY,
          data: { type: 'weekly_availability_reminder' },
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

      const result = await service.sendToUser('user-1', 'weekly_availability_reminder', {});

      expect(result).toEqual({ sent: 1 });
      expect(prisma.pushToken.deleteMany).toHaveBeenCalledWith({
        where: { token: { in: ['invalid-token'] } },
      });
    });

    it('should return sent 0 on FCM fatal error', async () => {
      service.onModuleInit();
      prisma.pushToken.findMany.mockResolvedValue([{ token: 'tok' }]);
      mockSendEachForMulticast.mockRejectedValue(new Error('FCM down'));

      const result = await service.sendToUser('user-1', 'weekly_availability_reminder', {});

      expect(result).toEqual({ sent: 0 });
    });

    it('should create a notification log after successful send', async () => {
      service.onModuleInit();
      prisma.pushToken.findMany.mockResolvedValue([
        { userId: 'user-1', token: 'tok-1' },
        { userId: 'user-1', token: 'tok-2' },
      ]);
      prisma.notificationLog.create.mockResolvedValue({});
      mockSendEachForMulticast.mockResolvedValue({
        successCount: 2,
        failureCount: 0,
        responses: [{ success: true }, { success: true }],
      });

      await service.sendToUser('user-1', 'new_event', NEW_EVENT, { screen: 'home' });

      expect(prisma.notificationLog.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          type: 'new_event',
          title: NEW_EVENT_COPY.title,
          body: NEW_EVENT_COPY.body,
          data: { screen: 'home', type: 'new_event' },
          tokenCount: 2,
          sentCount: 2,
          failedCount: 0,
        },
      });
    });

    it('should create a notification log with failure counts', async () => {
      service.onModuleInit();
      prisma.pushToken.findMany.mockResolvedValue([
        { userId: 'user-1', token: 'valid' },
        { userId: 'user-1', token: 'invalid' },
      ]);
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

      await service.sendToUser('user-1', 'weekly_availability_reminder', {});

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

      await service.sendToUser('user-1', 'weekly_availability_reminder', {});

      expect(prisma.notificationLog.create).not.toHaveBeenCalled();
    });

    it('should not create a log when notification type is disabled', async () => {
      prisma.notificationPreference.findUnique.mockResolvedValue({ enabled: false });

      await service.sendToUser('user-1', 'new_event', NEW_EVENT);

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

      await service.sendToUser('user-1', 'weekly_availability_reminder', {});

      expect(mockSendEachForMulticast).toHaveBeenCalledTimes(1);
      const [[calledMessage]] = mockSendEachForMulticast.mock.calls;
      expect(calledMessage).toEqual(
        expect.objectContaining({
          tokens: ['web-token'],
          data: { type: 'weekly_availability_reminder', ...REMINDER_COPY },
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

      await service.sendToUser('user-1', 'weekly_availability_reminder', {});

      expect(mockSendEachForMulticast).toHaveBeenCalledTimes(1);
      expect(mockSendEachForMulticast).toHaveBeenCalledWith(
        expect.objectContaining({
          tokens: ['android-token'],
          notification: REMINDER_COPY,
          data: { type: 'weekly_availability_reminder' },
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

      await service.sendToUser('user-1', 'weekly_availability_reminder', {});

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

      expect(androidCall).toEqual(expect.objectContaining({ notification: REMINDER_COPY }));
      expect(webCall).not.toHaveProperty('notification');
      expect(webCall?.data).toEqual({ type: 'weekly_availability_reminder', ...REMINDER_COPY });
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

      await service.sendToUser('user-1', 'weekly_availability_reminder', {});

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

      await service.sendToUser('user-1', 'weekly_availability_reminder', {});

      expect(mockSendEachForMulticast).toHaveBeenCalledTimes(1);
      expect(mockSendEachForMulticast).toHaveBeenCalledWith(
        expect.objectContaining({ notification: REMINDER_COPY }),
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

      await service.sendToUser('user-1', 'weekly_availability_reminder', {});

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

      await service.sendToUser('user-1', 'weekly_availability_reminder', {});

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

      await service.sendToUser('user-1', 'weekly_availability_reminder', {});

      expect(mockSendEachForMulticast).toHaveBeenCalledTimes(1);
      expect(mockSendEachForMulticast).toHaveBeenCalledWith(
        expect.objectContaining({
          notification: REMINDER_COPY,
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
      expect(prisma.pushToken.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1' } }),
      );
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
            title: 'Notificación de prueba',
            body: 'Si ves esto, las notificaciones funcionan',
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

      await service.sendToGroup('group-1', 'new_event', NEW_EVENT, 'user-1');

      expect(prisma.pushToken.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: { in: ['user-2'] } },
        }),
      );
    });

    it('should return sent 0 when no members', async () => {
      prisma.groupMember.findMany.mockResolvedValue([]);

      const result = await service.sendToGroup('group-1', 'new_event', NEW_EVENT);

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

      await service.sendToGroup('group-1', 'new_event', NEW_EVENT);

      expect(prisma.pushToken.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: { in: ['user-1', 'user-3'] } },
        }),
      );
    });

    it('should look the preference up for the type being sent', async () => {
      prisma.groupMember.findMany.mockResolvedValue([{ userId: 'user-1' }, { userId: 'user-2' }]);
      prisma.pushToken.findMany.mockResolvedValue([]);

      await service.sendToGroup('group-1', 'new_event', NEW_EVENT);

      expect(prisma.notificationPreference.findMany).toHaveBeenCalledWith({
        where: { userId: { in: ['user-1', 'user-2'] }, type: 'new_event', enabled: false },
      });
    });

    it('should log one notification_logs row per recipient', async () => {
      service.onModuleInit();
      prisma.groupMember.findMany.mockResolvedValue([{ userId: 'user-1' }, { userId: 'user-2' }]);
      prisma.notificationPreference.findMany.mockResolvedValue([]);
      prisma.pushToken.findMany.mockResolvedValue([
        { userId: 'user-1', token: 'tok-1', platform: 'android' },
        { userId: 'user-2', token: 'tok-2', platform: 'android' },
      ]);
      prisma.notificationLog.create.mockResolvedValue({});
      mockSendEachForMulticast.mockResolvedValue({
        successCount: 2,
        failureCount: 0,
        responses: [{ success: true }, { success: true }],
      });

      await service.sendToGroup('group-1', 'new_event', NEW_EVENT);

      expect(prisma.notificationLog.create).toHaveBeenCalledTimes(2);
      for (const userId of ['user-1', 'user-2']) {
        expect(prisma.notificationLog.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            userId,
            type: 'new_event',
            title: NEW_EVENT_COPY.title,
            tokenCount: 1,
            sentCount: 1,
            failedCount: 0,
          }),
        });
      }
    });

    it('should attribute an FCM failure to the recipient that owns the token', async () => {
      service.onModuleInit();
      prisma.groupMember.findMany.mockResolvedValue([{ userId: 'user-1' }, { userId: 'user-2' }]);
      prisma.pushToken.findMany.mockResolvedValue([
        { userId: 'user-1', token: 'tok-1', platform: 'android' },
        { userId: 'user-2', token: 'tok-2', platform: 'android' },
      ]);
      prisma.notificationLog.create.mockResolvedValue({});
      mockSendEachForMulticast.mockResolvedValue({
        successCount: 1,
        failureCount: 1,
        responses: [
          { success: true },
          { success: false, error: { code: 'messaging/internal-error', message: 'boom' } },
        ],
      });

      await service.sendToGroup('group-1', 'new_event', NEW_EVENT);

      expect(prisma.notificationLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: 'user-1', sentCount: 1, failedCount: 0 }),
      });
      expect(prisma.notificationLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: 'user-2', sentCount: 0, failedCount: 1 }),
      });
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

      await service.sendToGroup('group-1', 'new_event', NEW_EVENT, 'user-1');

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
        'event_cancelled',
        { title: 'Cena' },
        'user-1',
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

      await service.sendToEventAttendees('event-1', 'event_cancelled', { title: 'Cena' }, 'user-1');

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

      const result = await service.sendToEventAttendees('event-1', 'event_cancelled', {
        title: 'Cena',
      });

      expect(result).toEqual({ sent: 0 });
    });

    it('should log one notification_logs row per attendee', async () => {
      service.onModuleInit();
      prisma.eventAttendee.findMany.mockResolvedValue([
        { userId: 'user-1', status: 'confirmed' },
        { userId: 'user-2', status: 'confirmed' },
      ]);
      prisma.notificationPreference.findMany.mockResolvedValue([]);
      prisma.pushToken.findMany.mockResolvedValue([
        { userId: 'user-1', token: 'tok-1', platform: 'android' },
        { userId: 'user-2', token: 'tok-2', platform: 'web' },
      ]);
      prisma.notificationLog.create.mockResolvedValue({});
      mockSendEachForMulticast.mockResolvedValue({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true }],
      });

      await service.sendToEventAttendees('event-1', 'event_cancelled', { title: 'Cena' });

      expect(prisma.notificationLog.create).toHaveBeenCalledTimes(2);
      expect(prisma.notificationLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          type: 'event_cancelled',
          tokenCount: 1,
          sentCount: 1,
        }),
      });
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
        'event_updated',
        { title: 'Cena' },
        undefined,
        undefined,
        'confirmed',
      );

      expect(prisma.pushToken.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: { in: ['user-1'] } },
        }),
      );
    });
  });
  // One text for the whole group was the bug: a group with an English speaker got the
  // Spanish copy. The fan-out now sends one FCM batch per language present.
  /**
   * The inbox row is written at the same point as the push, so a notice reaches
   * somebody who has no device registered — or who never granted permission — instead
   * of evaporating. It carries the copy in the reader's own language and the same
   * `data` the push routes on.
   */
  describe('inbox persistence', () => {
    beforeEach(() => {
      prisma.user.findMany.mockResolvedValue([{ id: 'user-1', language: 'es' }]);
      prisma.pushToken.findMany.mockResolvedValue([]);
      prisma.notificationLog.create.mockResolvedValue({});
    });

    it('should persist a row for a recipient with no push tokens', async () => {
      prisma.notificationPreference.findUnique.mockResolvedValue(null);

      await service.sendToUser('user-1', 'new_event', NEW_EVENT, { eventId: 'e1' });

      expect(prisma.notification.createMany).toHaveBeenCalledWith({
        data: [
          {
            userId: 'user-1',
            type: 'new_event',
            title: NEW_EVENT_COPY.title,
            body: NEW_EVENT_COPY.body,
            data: { eventId: 'e1', type: 'new_event' },
          },
        ],
      });
    });

    it('should not persist anything when the user turned the type off', async () => {
      prisma.notificationPreference.findUnique.mockResolvedValue({ enabled: false });

      await service.sendToUser('user-1', 'new_event', NEW_EVENT);

      expect(prisma.notification.createMany).not.toHaveBeenCalled();
    });

    it('should write each row in its own reader language', async () => {
      prisma.groupMember.findMany.mockResolvedValue([{ userId: 'user-1' }, { userId: 'user-2' }]);
      prisma.user.findMany.mockResolvedValue([
        { id: 'user-1', language: 'es' },
        { id: 'user-2', language: 'en' },
      ]);

      await service.sendToGroup('group-1', 'new_event', NEW_EVENT, undefined, {
        eventId: 'e1',
        groupId: 'group-1',
      });

      const [[{ data: rows }]] = prisma.notification.createMany.mock.calls;
      expect(rows).toEqual([
        expect.objectContaining({ userId: 'user-1', title: 'Nueva quedada' }),
        expect.objectContaining({ userId: 'user-2', title: 'New plan' }),
      ]);
    });

    it('should fall back to Spanish for a user whose language is unknown', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: 'user-1', language: null }]);

      await service.sendToUser('user-1', 'new_event', NEW_EVENT);

      const [[{ data: rows }]] = prisma.notification.createMany.mock.calls;
      expect(rows[0].title).toBe(NEW_EVENT_COPY.title);
    });

    it('should skip a recipient the users table does not know', async () => {
      prisma.groupMember.findMany.mockResolvedValue([{ userId: 'user-1' }, { userId: 'ghost' }]);
      prisma.user.findMany.mockResolvedValue([{ id: 'user-1', language: 'es' }]);

      await service.sendToGroup('group-1', 'new_event', NEW_EVENT);

      const [[{ data: rows }]] = prisma.notification.createMany.mock.calls;
      expect(rows.map((r: { userId: string }) => r.userId)).toEqual(['user-1']);
    });

    it('should exclude the actor, like the push does', async () => {
      prisma.groupMember.findMany.mockResolvedValue([{ userId: 'user-1' }, { userId: 'user-2' }]);
      prisma.user.findMany.mockResolvedValue([
        { id: 'user-1', language: 'es' },
        { id: 'user-2', language: 'es' },
      ]);

      await service.sendToGroup('group-1', 'new_event', NEW_EVENT, 'user-2');

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['user-1'] } },
        select: { id: true, language: true },
      });
    });

    it('should persist for event attendees too', async () => {
      prisma.eventAttendee.findMany.mockResolvedValue([{ userId: 'user-1' }]);

      await service.sendToEventAttendees('event-1', 'event_updated', { title: 'Cena' }, undefined, {
        eventId: 'event-1',
      });

      const [[{ data: rows }]] = prisma.notification.createMany.mock.calls;
      expect(rows[0]).toEqual(
        expect.objectContaining({
          userId: 'user-1',
          type: 'event_updated',
          data: { eventId: 'event-1', type: 'event_updated' },
        }),
      );
    });

    it('should not persist the test notification', async () => {
      prisma.pushToken.findMany.mockResolvedValue([
        { userId: 'user-1', token: 'tok-1', platform: 'android', user: { language: 'es' } },
      ]);
      mockSendEachForMulticast.mockResolvedValue({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true }],
      });
      service.onModuleInit();

      await service.sendTestNotification('user-1', {});

      expect(prisma.notification.createMany).not.toHaveBeenCalled();
    });

    it('should still send the push when the inbox write fails', async () => {
      jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
      prisma.notification.createMany.mockRejectedValue(new Error('db down'));
      prisma.pushToken.findMany.mockResolvedValue([
        { userId: 'user-1', token: 'tok-1', platform: 'android', user: { language: 'es' } },
      ]);
      mockSendEachForMulticast.mockResolvedValue({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true }],
      });
      service.onModuleInit();

      const result = await service.sendToUser('user-1', 'new_event', NEW_EVENT);

      expect(result).toEqual({ sent: 1 });
    });

    it('should carry the localized data extras of the copy', async () => {
      prisma.groupMember.findMany.mockResolvedValue([{ userId: 'user-1' }]);
      prisma.user.findMany.mockResolvedValue([{ id: 'user-1', language: 'en' }]);

      await service.sendToGroup(
        'group-1',
        'new_poll',
        {
          actorName: 'Ana',
          groupName: 'Cuadrilla',
          date: new Date('2026-09-07T00:00:00Z'),
          slot: null,
        },
        undefined,
        { pollId: 'poll-1', groupId: 'group-1' },
      );

      const [[{ data: rows }]] = prisma.notification.createMany.mock.calls;
      expect(rows[0].data).toEqual(
        expect.objectContaining({ pollId: 'poll-1', groupId: 'group-1', type: 'new_poll' }),
      );
    });
  });

  /**
   * The bandeja itself: paging, the unread counter and the two ways of marking read.
   */
  describe('inbox reading', () => {
    const ROW = {
      id: '11111111-1111-4111-8111-111111111111',
      type: 'new_event',
      title: 'Nueva quedada',
      body: 'Ana ha creado "Cena"',
      data: { type: 'new_event', eventId: 'e1' },
      readAt: null,
      createdAt: new Date('2026-09-08T10:00:00Z'),
    };

    describe('listInbox', () => {
      it('should return the newest first, with the unread counter', async () => {
        prisma.notification.findMany.mockResolvedValue([ROW]);
        prisma.notification.count.mockResolvedValue(3);

        const result = await service.listInbox('user-1', {});

        expect(result).toEqual({ items: [ROW], nextCursor: null, unreadCount: 3 });
        expect(prisma.notification.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { userId: 'user-1' },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: 31,
          }),
        );
        expect(prisma.notification.count).toHaveBeenCalledWith({
          where: { userId: 'user-1', readAt: null },
        });
      });

      it('should hand back a cursor only when there is another page', async () => {
        const page = Array.from({ length: 3 }, (_, i) => ({ ...ROW, id: `row-${i}` }));
        prisma.notification.findMany.mockResolvedValue(page);

        const result = await service.listInbox('user-1', { limit: 2 });

        expect(result.items.map((n) => n.id)).toEqual(['row-0', 'row-1']);
        expect(result.nextCursor).toBe('row-1');
      });

      it('should page from the cursor row, ties broken by id', async () => {
        prisma.notification.findFirst.mockResolvedValue({ id: ROW.id, createdAt: ROW.createdAt });
        prisma.notification.findMany.mockResolvedValue([]);

        await service.listInbox('user-1', { cursor: ROW.id });

        expect(prisma.notification.findFirst).toHaveBeenCalledWith({
          where: { id: ROW.id, userId: 'user-1' },
          select: { id: true, createdAt: true },
        });
        const [[args]] = prisma.notification.findMany.mock.calls;
        expect(args.where).toEqual({
          userId: 'user-1',
          OR: [
            { createdAt: { lt: ROW.createdAt } },
            { createdAt: ROW.createdAt, id: { lt: ROW.id } },
          ],
        });
      });

      it('should ignore a cursor that is not one of your own notices', async () => {
        prisma.notification.findFirst.mockResolvedValue(null);
        prisma.notification.findMany.mockResolvedValue([]);

        await service.listInbox('user-1', { cursor: ROW.id });

        const [[args]] = prisma.notification.findMany.mock.calls;
        expect(args.where).toEqual({ userId: 'user-1' });
      });
    });

    describe('markAllRead', () => {
      it('should stamp every unread notice of the caller', async () => {
        prisma.notification.updateMany.mockResolvedValue({ count: 4 });

        const result = await service.markAllRead('user-1');

        expect(result).toEqual({ updated: 4 });
        const [[args]] = prisma.notification.updateMany.mock.calls;
        expect(args.where).toEqual({ userId: 'user-1', readAt: null });
        expect(args.data.readAt).toBeInstanceOf(Date);
      });
    });

    describe('markRead', () => {
      it('should stamp one notice, scoped to its owner', async () => {
        prisma.notification.updateMany.mockResolvedValue({ count: 1 });

        const result = await service.markRead('user-1', ROW.id);

        expect(result).toEqual({ success: true });
        const [[args]] = prisma.notification.updateMany.mock.calls;
        expect(args.where).toEqual({ id: ROW.id, userId: 'user-1', readAt: null });
      });

      it('should stay quiet about an id that is not yours', async () => {
        prisma.notification.updateMany.mockResolvedValue({ count: 0 });

        await expect(service.markRead('user-1', ROW.id)).resolves.toEqual({ success: true });
      });
    });
  });

  describe('per-language fan-out', () => {
    const MONDAY = new Date('2026-09-07T00:00:00Z');

    beforeEach(() => {
      service.onModuleInit();
      prisma.groupMember.findMany.mockResolvedValue([{ userId: 'es-user' }, { userId: 'en-user' }]);
      prisma.notificationLog.create.mockResolvedValue({});
      mockSendEachForMulticast.mockImplementation((message: { tokens: string[] }) => ({
        successCount: message.tokens.length,
        failureCount: 0,
        responses: message.tokens.map(() => ({ success: true })),
      }));
    });

    it('should send one batch per language, each with its own copy', async () => {
      prisma.pushToken.findMany.mockResolvedValue([
        { userId: 'es-user', token: 'tok-es', platform: 'android', user: { language: 'es' } },
        { userId: 'en-user', token: 'tok-en', platform: 'android', user: { language: 'en' } },
      ]);

      await service.sendToGroup('group-1', 'new_event', NEW_EVENT);

      expect(mockSendEachForMulticast).toHaveBeenCalledTimes(2);
      expect(mockSendEachForMulticast).toHaveBeenCalledWith(
        expect.objectContaining({ tokens: ['tok-es'], notification: NEW_EVENT_COPY }),
      );
      expect(mockSendEachForMulticast).toHaveBeenCalledWith(
        expect.objectContaining({
          tokens: ['tok-en'],
          notification: { title: 'New plan', body: 'Ana created "Cena"' },
        }),
      );
    });

    it('should keep one batch when everybody reads the same language', async () => {
      prisma.pushToken.findMany.mockResolvedValue([
        { userId: 'es-user', token: 'tok-1', platform: 'android', user: { language: 'es' } },
        { userId: 'en-user', token: 'tok-2', platform: 'android', user: { language: 'es' } },
      ]);

      await service.sendToGroup('group-1', 'new_event', NEW_EVENT);

      expect(mockSendEachForMulticast).toHaveBeenCalledTimes(1);
    });

    it('should fall back to Spanish for a missing or unknown language', async () => {
      prisma.pushToken.findMany.mockResolvedValue([
        { userId: 'es-user', token: 'tok-1', platform: 'android' },
        { userId: 'en-user', token: 'tok-2', platform: 'android', user: { language: 'klingon' } },
      ]);

      await service.sendToGroup('group-1', 'new_event', NEW_EVENT);

      expect(mockSendEachForMulticast).toHaveBeenCalledTimes(1);
      expect(mockSendEachForMulticast).toHaveBeenCalledWith(
        expect.objectContaining({ tokens: ['tok-1', 'tok-2'], notification: NEW_EVENT_COPY }),
      );
    });

    it('should log every recipient with the copy of their own language', async () => {
      prisma.pushToken.findMany.mockResolvedValue([
        { userId: 'es-user', token: 'tok-es', platform: 'android', user: { language: 'es' } },
        { userId: 'en-user', token: 'tok-en', platform: 'android', user: { language: 'en' } },
      ]);

      await service.sendToGroup('group-1', 'new_event', NEW_EVENT);

      expect(prisma.notificationLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: 'es-user', title: NEW_EVENT_COPY.title }),
      });
      expect(prisma.notificationLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: 'en-user', title: 'New plan' }),
      });
    });

    it('should derive data.type from the notification type and keep the caller extras', async () => {
      prisma.pushToken.findMany.mockResolvedValue([
        { userId: 'es-user', token: 'tok-es', platform: 'android', user: { language: 'es' } },
      ]);

      await service.sendToGroup('group-1', 'new_event', NEW_EVENT, undefined, {
        eventId: 'event-1',
        groupId: 'group-1',
      });

      expect(mockSendEachForMulticast).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { eventId: 'event-1', groupId: 'group-1', type: 'new_event' },
        }),
      );
    });

    it('should localize the yes/no button labels the web SW reads from new_poll data', async () => {
      prisma.pushToken.findMany.mockResolvedValue([
        { userId: 'es-user', token: 'tok-es', platform: 'web', user: { language: 'es' } },
        { userId: 'en-user', token: 'tok-en', platform: 'web', user: { language: 'en' } },
      ]);

      await service.sendToGroup(
        'group-1',
        'new_poll',
        { actorName: 'Ana', groupName: 'Cuadrilla', date: MONDAY, slot: null },
        undefined,
        { pollId: 'poll-1' },
      );

      expect(mockSendEachForMulticast).toHaveBeenCalledWith(
        expect.objectContaining({
          tokens: ['tok-es'],
          data: expect.objectContaining({
            title: '¿Puedes el lunes?',
            yesLabel: 'Puedo',
            noLabel: 'No puedo',
            type: 'new_poll',
            pollId: 'poll-1',
          }),
        }),
      );
      expect(mockSendEachForMulticast).toHaveBeenCalledWith(
        expect.objectContaining({
          tokens: ['tok-en'],
          data: expect.objectContaining({
            title: 'Can you make Monday?',
            yesLabel: 'I can',
            noLabel: "I can't",
          }),
        }),
      );
    });
  });
});
