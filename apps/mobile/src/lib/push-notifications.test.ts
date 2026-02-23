import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Capacitor core
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn().mockReturnValue(false),
  },
}));

// Mock Capacitor PushNotifications (already in setup, but override to control per-test)
vi.mock('@capacitor/push-notifications', () => ({
  PushNotifications: {
    addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }),
    requestPermissions: vi.fn().mockResolvedValue({ receive: 'granted' }),
    register: vi.fn(),
  },
}));

// Mock firebase module
vi.mock('./firebase', () => ({
  getFirebaseMessaging: vi.fn().mockResolvedValue(null),
}));

// Mock firebase/messaging
vi.mock('firebase/messaging', () => ({
  getToken: vi.fn(),
  onMessage: vi.fn(),
}));

// Mock api module
vi.mock('./api', () => ({
  api: {
    post: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    get: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
  },
}));

import { Capacitor } from '@capacitor/core';
import { api } from './api';
import {
  sendTokenToBackend,
  unregisterFromBackend,
  getCurrentToken,
  setCurrentToken,
  setupWebForegroundHandler,
  resetNativePushSetup,
} from './push-notifications';
import { getFirebaseMessaging } from './firebase';
import { onMessage } from 'firebase/messaging';

describe('push-notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset module-level state via the exported setters
    setCurrentToken(null);
    resetNativePushSetup();
  });

  describe('sendTokenToBackend', () => {
    it('should call api.post with token and web platform when not native', async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);

      await sendTokenToBackend('web-token-123');

      expect(api.post).toHaveBeenCalledWith('/notifications/register-token', {
        token: 'web-token-123',
        platform: 'web',
      });
    });

    it('should call api.post with token and android platform when native', async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);

      await sendTokenToBackend('native-token-456');

      expect(api.post).toHaveBeenCalledWith('/notifications/register-token', {
        token: 'native-token-456',
        platform: 'android',
      });
    });
  });

  describe('unregisterFromBackend', () => {
    it('should call api.delete with the current token', async () => {
      setCurrentToken('token-to-remove');

      await unregisterFromBackend();

      expect(api.delete).toHaveBeenCalledWith(
        '/notifications/unregister-token',
        { token: 'token-to-remove' },
      );
    });

    it('should clear currentToken after unregistering', async () => {
      setCurrentToken('token-to-remove');

      await unregisterFromBackend();

      expect(getCurrentToken()).toBeNull();
    });

    it('should do nothing when currentToken is null', async () => {
      setCurrentToken(null);

      await unregisterFromBackend();

      expect(api.delete).not.toHaveBeenCalled();
    });

    it('should not throw when api.delete fails', async () => {
      setCurrentToken('failing-token');
      vi.mocked(api.delete).mockRejectedValueOnce(new Error('network error'));

      await expect(unregisterFromBackend()).resolves.toBeUndefined();
    });

    it('should clear currentToken even when api.delete fails', async () => {
      setCurrentToken('failing-token');
      vi.mocked(api.delete).mockRejectedValueOnce(new Error('network error'));

      await unregisterFromBackend();

      expect(getCurrentToken()).toBeNull();
    });
  });

  describe('navigateFromPush (via window.location.href)', () => {
    // navigateFromPush is not exported, but it is triggered internally.
    // We test it by importing the module and calling the push-notification
    // action listener. Since navigateFromPush sets window.location.href,
    // we spy on that.
    let hrefSetter: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      hrefSetter = vi.fn();
      Object.defineProperty(window, 'location', {
        value: { href: '' },
        writable: true,
        configurable: true,
      });
      Object.defineProperty(window.location, 'href', {
        set: hrefSetter,
        get: () => '',
        configurable: true,
      });
    });

    // Helper: we dynamically re-import to get fresh module and call
    // the private navigateFromPush through setupPushListeners' action callback.
    // However, since navigateFromPush is private, we test it indirectly
    // through the push notification action listener.

    // Alternative approach: test the navigation logic directly by extracting
    // the data -> URL mapping. Since we cannot export the private function,
    // we use the PushNotifications.addListener mock to capture callbacks.

    it('should navigate to group page for member_joined', async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);

      const { PushNotifications } = await import(
        '@capacitor/push-notifications'
      );
      const { setupPushListeners } = await import('./push-notifications');

      setupPushListeners();

      // Find the 'pushNotificationActionPerformed' listener
      const actionCall = vi.mocked(PushNotifications.addListener).mock.calls.find(
        (call) => call[0] === 'pushNotificationActionPerformed',
      );
      expect(actionCall).toBeDefined();

      const callback = actionCall![1] as (action: {
        notification: { data: Record<string, string> };
      }) => void;

      callback({
        notification: {
          data: { type: 'member_joined', groupId: '00000000-0000-0000-0000-000000000001' },
        },
      });

      expect(hrefSetter).toHaveBeenCalledWith('/tabs/group/00000000-0000-0000-0000-000000000001');
    });

    it('should navigate to group page for member_left', async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);

      const { PushNotifications } = await import(
        '@capacitor/push-notifications'
      );
      const { setupPushListeners } = await import('./push-notifications');

      setupPushListeners();

      const actionCall = vi.mocked(PushNotifications.addListener).mock.calls.find(
        (call) => call[0] === 'pushNotificationActionPerformed',
      );
      const callback = actionCall![1] as (action: {
        notification: { data: Record<string, string> };
      }) => void;

      callback({
        notification: {
          data: { type: 'member_left', groupId: '00000000-0000-0000-0000-000000000002' },
        },
      });

      expect(hrefSetter).toHaveBeenCalledWith('/tabs/group/00000000-0000-0000-0000-000000000002');
    });

    it('should navigate to /tabs/group without groupId for member_joined', async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);

      const { PushNotifications } = await import(
        '@capacitor/push-notifications'
      );
      const { setupPushListeners } = await import('./push-notifications');

      setupPushListeners();

      const actionCall = vi.mocked(PushNotifications.addListener).mock.calls.find(
        (call) => call[0] === 'pushNotificationActionPerformed',
      );
      const callback = actionCall![1] as (action: {
        notification: { data: Record<string, string> };
      }) => void;

      callback({
        notification: {
          data: { type: 'member_joined' },
        },
      });

      expect(hrefSetter).toHaveBeenCalledWith('/tabs/group');
    });

    it('should navigate to plans with eventId for event types', async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);

      const { PushNotifications } = await import(
        '@capacitor/push-notifications'
      );
      const { setupPushListeners } = await import('./push-notifications');

      setupPushListeners();

      const actionCall = vi.mocked(PushNotifications.addListener).mock.calls.find(
        (call) => call[0] === 'pushNotificationActionPerformed',
      );
      const callback = actionCall![1] as (action: {
        notification: { data: Record<string, string> };
      }) => void;

      callback({
        notification: {
          data: { type: 'event_confirmed', eventId: '00000000-0000-0000-0000-000000000001', groupId: '00000000-0000-0000-0000-000000000001' },
        },
      });

      expect(hrefSetter).toHaveBeenCalledWith('/tabs/plans?eventId=00000000-0000-0000-0000-000000000001');
    });

    it('should navigate to plans with eventId for new_event', async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);

      const { PushNotifications } = await import(
        '@capacitor/push-notifications'
      );
      const { setupPushListeners } = await import('./push-notifications');

      setupPushListeners();

      const actionCall = vi.mocked(PushNotifications.addListener).mock.calls.find(
        (call) => call[0] === 'pushNotificationActionPerformed',
      );
      const callback = actionCall![1] as (action: {
        notification: { data: Record<string, string> };
      }) => void;

      callback({
        notification: {
          data: { type: 'new_event', eventId: '00000000-0000-0000-0000-000000000002' },
        },
      });

      expect(hrefSetter).toHaveBeenCalledWith('/tabs/plans?eventId=00000000-0000-0000-0000-000000000002');
    });

    it('should navigate to /tabs/plans as fallback when no eventId', async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);

      const { PushNotifications } = await import(
        '@capacitor/push-notifications'
      );
      const { setupPushListeners } = await import('./push-notifications');

      setupPushListeners();

      const actionCall = vi.mocked(PushNotifications.addListener).mock.calls.find(
        (call) => call[0] === 'pushNotificationActionPerformed',
      );
      const callback = actionCall![1] as (action: {
        notification: { data: Record<string, string> };
      }) => void;

      callback({
        notification: {
          data: { type: 'some_other_type' },
        },
      });

      expect(hrefSetter).toHaveBeenCalledWith('/tabs/plans');
    });

    it('should not navigate when data has no type', async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);

      const { PushNotifications } = await import(
        '@capacitor/push-notifications'
      );
      const { setupPushListeners } = await import('./push-notifications');

      setupPushListeners();

      const actionCall = vi.mocked(PushNotifications.addListener).mock.calls.find(
        (call) => call[0] === 'pushNotificationActionPerformed',
      );
      const callback = actionCall![1] as (action: {
        notification: { data: Record<string, string> };
      }) => void;

      callback({
        notification: {
          data: {},
        },
      });

      expect(hrefSetter).not.toHaveBeenCalled();
    });

    it('should store groupId in localStorage when present', async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);

      const { PushNotifications } = await import(
        '@capacitor/push-notifications'
      );
      const { setupPushListeners } = await import('./push-notifications');

      setupPushListeners();

      const actionCall = vi.mocked(PushNotifications.addListener).mock.calls.find(
        (call) => call[0] === 'pushNotificationActionPerformed',
      );
      const callback = actionCall![1] as (action: {
        notification: { data: Record<string, string> };
      }) => void;

      callback({
        notification: {
          data: { type: 'new_event', groupId: '00000000-0000-0000-0000-000000000005', eventId: '00000000-0000-0000-0000-000000000001' },
        },
      });

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'quedamos_current_group_id',
        '00000000-0000-0000-0000-000000000005',
      );
    });
  });

  describe('setupWebForegroundHandler', () => {
    // IMPORTANT: The module-level `webForegroundSetup` flag persists across
    // tests within the same module instance. Tests are ordered carefully:
    // 1. Native platform test (does not set the flag)
    // 2. Full web test (sets the flag, verifies getFirebaseMessaging + onMessage)
    // 3. Idempotency test (verifies the flag prevents a second setup)

    it('should not set up handler on native platform', () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);

      setupWebForegroundHandler();

      expect(getFirebaseMessaging).not.toHaveBeenCalled();
    });

    it('should call getFirebaseMessaging and register onMessage on web platform', async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
      const mockMessaging = { fake: 'messaging' };
      vi.mocked(getFirebaseMessaging).mockResolvedValue(mockMessaging as never);

      setupWebForegroundHandler();

      expect(getFirebaseMessaging).toHaveBeenCalled();

      // Wait for the async getFirebaseMessaging().then() to resolve
      await vi.waitFor(() => {
        expect(onMessage).toHaveBeenCalledWith(
          mockMessaging,
          expect.any(Function),
        );
      });
    });

    it('should be idempotent - calling twice only sets up once', () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);

      // The webForegroundSetup flag is already true from the previous test,
      // so this call should be a no-op
      vi.mocked(getFirebaseMessaging).mockClear();

      setupWebForegroundHandler();

      expect(getFirebaseMessaging).not.toHaveBeenCalled();
    });
  });

  describe('setupPushListeners', () => {
    it('should not set up listeners on web platform', async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
      const { PushNotifications } = await import(
        '@capacitor/push-notifications'
      );
      vi.mocked(PushNotifications.addListener).mockClear();

      const { setupPushListeners } = await import('./push-notifications');
      setupPushListeners();

      expect(PushNotifications.addListener).not.toHaveBeenCalled();
    });
  });

  describe('getCurrentToken / setCurrentToken', () => {
    it('should return null initially', () => {
      expect(getCurrentToken()).toBeNull();
    });

    it('should store and retrieve a token', () => {
      setCurrentToken('my-token');

      expect(getCurrentToken()).toBe('my-token');
    });

    it('should allow clearing the token', () => {
      setCurrentToken('my-token');
      setCurrentToken(null);

      expect(getCurrentToken()).toBeNull();
    });
  });
});
