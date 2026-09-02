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
  registerForPush,
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

  describe('registerForPush (native token rotation)', () => {
    it('resends a new token to the backend when the registration listener fires again after the initial token', async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);

      const { PushNotifications } = await import('@capacitor/push-notifications');

      const registerPromise = registerForPush();

      // Wait for the 'registration' listener to be registered via addListener.
      await vi.waitFor(() => {
        const registered = vi
          .mocked(PushNotifications.addListener)
          .mock.calls.some((call) => call[0] === 'registration');
        expect(registered).toBe(true);
      });

      const registrationCall = vi
        .mocked(PushNotifications.addListener)
        .mock.calls.find((call) => call[0] === 'registration');
      const registrationCallback = registrationCall![1] as (t: { value: string }) => void;

      // Initial token arrives — resolves registerForPush() as today.
      registrationCallback({ value: 'initial-token' });

      const { token } = await registerPromise;
      expect(token).toBe('initial-token');

      vi.mocked(api.post).mockClear();

      // FCM rotates the token after the initial registration.
      registrationCallback({ value: 'rotated-token' });

      await vi.waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/notifications/register-token', {
          token: 'rotated-token',
          platform: 'android',
        });
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

    it('should navigate to calendar with pollId for new_poll', async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);

      const { PushNotifications } = await import(
        '@capacitor/push-notifications'
      );
      const { setupPushListeners } = await import('./push-notifications');

      setupPushListeners();

      const actionCall = vi.mocked(PushNotifications.addListener).mock.calls.find(
        (call) => call[0] === 'pushNotificationActionPerformed',
      );
      if (!actionCall) throw new Error('pushNotificationActionPerformed listener not registered');
      const callback = actionCall[1] as (action: {
        notification: { data: Record<string, string> };
      }) => void;

      callback({
        notification: {
          data: {
            type: 'new_poll',
            pollId: '00000000-0000-0000-0000-000000000010',
            groupId: '00000000-0000-0000-0000-000000000011',
          },
        },
      });

      expect(hrefSetter).toHaveBeenCalledWith(
        '/tabs/calendar?pollId=00000000-0000-0000-0000-000000000010&groupId=00000000-0000-0000-0000-000000000011',
      );
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'quedamos_current_group_id',
        '00000000-0000-0000-0000-000000000011',
      );
    });

    it('should navigate to calendar with pollId only when groupId is not a valid UUID', async () => {
      // groupId travels alongside pollId so the service worker's notificationclick path
      // (which has no access to localStorage, unlike navigateFromPush) can still select
      // the right group on reload. Each field validates independently — garbage in one
      // must not suppress the other.
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);

      const { PushNotifications } = await import(
        '@capacitor/push-notifications'
      );
      const { setupPushListeners } = await import('./push-notifications');

      setupPushListeners();

      const actionCall = vi.mocked(PushNotifications.addListener).mock.calls.find(
        (call) => call[0] === 'pushNotificationActionPerformed',
      );
      if (!actionCall) throw new Error('pushNotificationActionPerformed listener not registered');
      const callback = actionCall[1] as (action: {
        notification: { data: Record<string, string> };
      }) => void;

      callback({
        notification: {
          data: {
            type: 'new_poll',
            pollId: '00000000-0000-0000-0000-000000000020',
            groupId: 'not-a-uuid',
          },
        },
      });

      expect(hrefSetter).toHaveBeenCalledWith(
        '/tabs/calendar?pollId=00000000-0000-0000-0000-000000000020',
      );
    });

    it('should navigate to calendar with groupId only when pollId is not a valid UUID', async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);

      const { PushNotifications } = await import(
        '@capacitor/push-notifications'
      );
      const { setupPushListeners } = await import('./push-notifications');

      setupPushListeners();

      const actionCall = vi.mocked(PushNotifications.addListener).mock.calls.find(
        (call) => call[0] === 'pushNotificationActionPerformed',
      );
      if (!actionCall) throw new Error('pushNotificationActionPerformed listener not registered');
      const callback = actionCall[1] as (action: {
        notification: { data: Record<string, string> };
      }) => void;

      callback({
        notification: {
          data: {
            type: 'new_poll',
            pollId: 'not-a-uuid',
            groupId: '00000000-0000-0000-0000-000000000021',
          },
        },
      });

      expect(hrefSetter).toHaveBeenCalledWith(
        '/tabs/calendar?groupId=00000000-0000-0000-0000-000000000021',
      );
    });

    it('should navigate to calendar WITHOUT pollId for poll_completed, even with a valid pollId present', async () => {
      // poll_completed is informational only ("El aro se cierra") — its poll is already
      // `completed`, so usePendingQuestions filters it out by definition and the mazo can
      // never consume a focused pollId for it. Routing it into the deep-link param would
      // just leak an unconsumable ?pollId= into the URL forever. Only new_poll (an actual
      // open question) gets the pollId param.
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);

      const { PushNotifications } = await import(
        '@capacitor/push-notifications'
      );
      const { setupPushListeners } = await import('./push-notifications');

      setupPushListeners();

      const actionCall = vi.mocked(PushNotifications.addListener).mock.calls.find(
        (call) => call[0] === 'pushNotificationActionPerformed',
      );
      if (!actionCall) throw new Error('pushNotificationActionPerformed listener not registered');
      const callback = actionCall[1] as (action: {
        notification: { data: Record<string, string> };
      }) => void;

      callback({
        notification: {
          data: { type: 'poll_completed', pollId: '00000000-0000-0000-0000-000000000012' },
        },
      });

      expect(hrefSetter).toHaveBeenCalledWith('/tabs/calendar');
    });

    it('should navigate to calendar without pollId when it is not a valid UUID', async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);

      const { PushNotifications } = await import(
        '@capacitor/push-notifications'
      );
      const { setupPushListeners } = await import('./push-notifications');

      setupPushListeners();

      const actionCall = vi.mocked(PushNotifications.addListener).mock.calls.find(
        (call) => call[0] === 'pushNotificationActionPerformed',
      );
      if (!actionCall) throw new Error('pushNotificationActionPerformed listener not registered');
      const callback = actionCall[1] as (action: {
        notification: { data: Record<string, string> };
      }) => void;

      callback({
        notification: {
          data: { type: 'new_poll', pollId: 'not-a-uuid' },
        },
      });

      expect(hrefSetter).toHaveBeenCalledWith('/tabs/calendar');
    });
  });

  describe('setupWebForegroundHandler', () => {
    // IMPORTANT: The module-level `webForegroundSetup` flag persists across
    // tests within the same module instance (there is no reset export for it,
    // unlike resetNativePushSetup). Tests are ordered carefully:
    // 1. Native platform test (does not set the flag)
    // 2. Full web test (sets the flag, verifies getFirebaseMessaging + onMessage,
    //    and captures the registered onMessage callback into
    //    `capturedOnMessageCallback` for reuse below — the flag being permanently
    //    set means onMessage is only ever registered once for this module instance)
    // 2a-2c. Payload-handling tests that invoke the captured callback directly with
    //    different payload shapes (data-first read + fallback to `notification`)
    // 3. Idempotency test (verifies the flag prevents a second setup)

    type ForegroundPayload = {
      notification?: { title?: string; body?: string };
      data?: Record<string, string>;
    };
    let capturedOnMessageCallback: ((payload: ForegroundPayload) => void) | null = null;
    let notificationCtor: ReturnType<typeof vi.fn>;

    function stubNotificationApi(): void {
      notificationCtor = vi.fn().mockImplementation(function (
        this: { onclick: (() => void) | null; close: () => void },
      ) {
        this.onclick = null;
        this.close = vi.fn();
      });
      Object.defineProperty(notificationCtor, 'permission', {
        value: 'granted',
        configurable: true,
      });
      vi.stubGlobal('Notification', notificationCtor);
    }

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

      // Capture the registered callback for the payload-handling tests below — the
      // webForegroundSetup flag makes onMessage a one-time registration for this
      // module instance, so later tests reuse this same function reference instead
      // of trying to trigger a fresh setupWebForegroundHandler() call.
      const call = vi.mocked(onMessage).mock.calls[0];
      capturedOnMessageCallback = call[1] as (payload: ForegroundPayload) => void;
    });

    it('should show a notification using title/body from payload.data when notification is absent', () => {
      if (!capturedOnMessageCallback) throw new Error('onMessage callback not captured');
      stubNotificationApi();

      capturedOnMessageCallback({
        data: { type: 'new_event', title: 'From data', body: 'Data body', eventId: 'e-1' },
      });

      expect(notificationCtor).toHaveBeenCalledWith(
        'From data',
        expect.objectContaining({ body: 'Data body', icon: '/logo.png' }),
      );
    });

    it('should prefer payload.data over payload.notification when both are present', () => {
      if (!capturedOnMessageCallback) throw new Error('onMessage callback not captured');
      stubNotificationApi();

      capturedOnMessageCallback({
        notification: { title: 'From notification', body: 'Notification body' },
        data: { type: 'new_event', title: 'From data', body: 'Data body' },
      });

      expect(notificationCtor).toHaveBeenCalledWith(
        'From data',
        expect.objectContaining({ body: 'Data body' }),
      );
    });

    it('should fall back to payload.notification when payload.data has no title/body', () => {
      // Resilience during rollout: an old backend still sends `notification` with no
      // title/body inside `data`. This case already worked before this change too — it
      // guards the deploy-window fallback rather than reproducing the duplicate-push bug.
      if (!capturedOnMessageCallback) throw new Error('onMessage callback not captured');
      stubNotificationApi();

      capturedOnMessageCallback({
        notification: { title: 'From notification', body: 'Notification body' },
        data: { type: 'new_event' },
      });

      expect(notificationCtor).toHaveBeenCalledWith(
        'From notification',
        expect.objectContaining({ body: 'Notification body' }),
      );
    });

    function stubServiceWorker(showNotification: ReturnType<typeof vi.fn>): void {
      Object.defineProperty(navigator, 'serviceWorker', {
        value: { ready: Promise.resolve({ showNotification }) },
        configurable: true,
      });
    }

    function clearServiceWorker(): void {
      Reflect.deleteProperty(navigator, 'serviceWorker');
    }

    it('shows the notification through the service worker when there is one', async () => {
      if (!capturedOnMessageCallback) throw new Error('onMessage callback not captured');
      stubNotificationApi();
      const showNotification = vi.fn().mockResolvedValue(undefined);
      stubServiceWorker(showNotification);

      try {
        capturedOnMessageCallback({
          data: { type: 'new_event', title: 'From data', body: 'Data body', eventId: 'e-1' },
        });

        await vi.waitFor(() => {
          expect(showNotification).toHaveBeenCalledWith(
            'From data',
            expect.objectContaining({ body: 'Data body', icon: '/logo.png' }),
          );
        });
        // Chrome on Android throws from the page-level constructor, so it must not run
        // when the registration handled it. Clicks land on the service worker's
        // notificationclick handler, which routes the same `data` fields.
        expect(notificationCtor).not.toHaveBeenCalled();
      } finally {
        clearServiceWorker();
      }
    });

    it('falls back to the constructor when the service worker refuses', async () => {
      if (!capturedOnMessageCallback) throw new Error('onMessage callback not captured');
      stubNotificationApi();
      const showNotification = vi.fn().mockRejectedValue(new Error('nope'));
      stubServiceWorker(showNotification);

      try {
        capturedOnMessageCallback({
          data: { type: 'new_event', title: 'From data', body: 'Data body' },
        });

        await vi.waitFor(() => {
          expect(notificationCtor).toHaveBeenCalledWith(
            'From data',
            expect.objectContaining({ body: 'Data body' }),
          );
        });
      } finally {
        clearServiceWorker();
      }
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
