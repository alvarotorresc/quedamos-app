import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

// The plugin is loaded through a dynamic import inside the native branch, so this mock is
// what the real one would be on a device.
const localNotifications = {
  // Capacitor's registerPlugin hands back a Proxy that answers to ANY property, `then`
  // included. Reproducing that here is deliberate: if the code ever resolves a promise
  // with the bare plugin again, the runtime treats it as a thenable, calls this and the
  // await never settles — which is what "LocalNotifications.then() is not implemented"
  // looks like on a device.
  then: vi.fn(),
  createChannel: vi.fn().mockResolvedValue(undefined),
  addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }),
  checkPermissions: vi.fn().mockResolvedValue({ display: 'granted' }),
  requestPermissions: vi.fn().mockResolvedValue({ display: 'granted' }),
  schedule: vi.fn().mockResolvedValue(undefined),
};
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: localNotifications }));

vi.mock('../i18n', () => ({ default: { t: (key: string) => key } }));

// The Android widget bridge: a no-op outside Android in the real module, mocked here so
// the widget_refresh path can be asserted instead of inferred.
// vi.hoisted: push-notifications.ts imports the bridge at the top of the module, so the
// factory runs before a plain const at this point in the file would exist.
const widgetBridge = vi.hoisted(() => ({
  notifyWidgetDataChanged: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./widget-bridge', () => widgetBridge);

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

      expect(hrefSetter).toHaveBeenCalledWith(
        '/tabs/plans?eventId=00000000-0000-0000-0000-000000000001&groupId=00000000-0000-0000-0000-000000000001',
      );
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

    async function actionCallback(): Promise<
      (action: { notification: { data: Record<string, string> } }) => void
    > {
      const { PushNotifications } = await import('@capacitor/push-notifications');
      const { setupPushListeners } = await import('./push-notifications');
      setupPushListeners();
      const call = vi
        .mocked(PushNotifications.addListener)
        .mock.calls.find((c) => c[0] === 'pushNotificationActionPerformed');
      if (!call) throw new Error('pushNotificationActionPerformed listener not registered');
      return call[1] as (action: { notification: { data: Record<string, string> } }) => void;
    }

    it('should open the group for role_changed instead of falling through to Planes', async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
      const callback = await actionCallback();

      callback({
        notification: {
          data: { type: 'role_changed', groupId: '00000000-0000-0000-0000-000000000030' },
        },
      });

      expect(hrefSetter).toHaveBeenCalledWith('/tabs/group/00000000-0000-0000-0000-000000000030');
    });

    it('should open the proposal for new_proposal instead of falling through to Planes', async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
      const callback = await actionCallback();

      callback({
        notification: {
          data: {
            type: 'new_proposal',
            proposalId: '00000000-0000-0000-0000-000000000031',
            groupId: '00000000-0000-0000-0000-000000000032',
          },
        },
      });

      expect(hrefSetter).toHaveBeenCalledWith(
        '/tabs/plans?proposalId=00000000-0000-0000-0000-000000000031&groupId=00000000-0000-0000-0000-000000000032',
      );
    });

    it('should open the calendar for weekly_availability_reminder', async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
      const callback = await actionCallback();

      callback({ notification: { data: { type: 'weekly_availability_reminder' } } });

      expect(hrefSetter).toHaveBeenCalledWith('/tabs/calendar');
    });

    it('should open the group list for member_kicked, never the group you are out of', async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
      const callback = await actionCallback();

      callback({
        notification: {
          data: { type: 'member_kicked', groupId: '00000000-0000-0000-0000-000000000040' },
        },
      });

      expect(hrefSetter).toHaveBeenCalledWith('/tabs/group');
    });

    it('should NOT remember the group you were kicked out of', async () => {
      // This used to be written to localStorage before the type was even looked at, so
      // the app came back selecting a group the API now answers 403 for.
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
      const callback = await actionCallback();

      callback({
        notification: {
          data: { type: 'member_kicked', groupId: '00000000-0000-0000-0000-000000000041' },
        },
      });

      expect(localStorage.setItem).not.toHaveBeenCalled();
    });

    it('should forget the remembered group when that group is deleted', async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
      localStorage.setItem('quedamos_current_group_id', '00000000-0000-0000-0000-000000000042');
      vi.mocked(localStorage.setItem).mockClear();
      const callback = await actionCallback();

      callback({
        notification: {
          data: { type: 'group_deleted', groupId: '00000000-0000-0000-0000-000000000042' },
        },
      });

      expect(localStorage.removeItem).toHaveBeenCalledWith('quedamos_current_group_id');
    });

    it('should leave another remembered group alone when kicked out of a different one', async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
      localStorage.setItem('quedamos_current_group_id', '00000000-0000-0000-0000-000000000043');
      const callback = await actionCallback();

      callback({
        notification: {
          data: { type: 'member_kicked', groupId: '00000000-0000-0000-0000-000000000044' },
        },
      });

      expect(localStorage.removeItem).not.toHaveBeenCalled();
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

  describe('a push that arrives with the app open (Android)', () => {
    let hrefSetter: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
      localNotifications.checkPermissions.mockResolvedValue({ display: 'granted' });
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

    async function receivedListener(): Promise<
      (notification: {
        title?: string;
        body?: string;
        data?: Record<string, string>;
        id: string;
      }) => void
    > {
      const { PushNotifications } = await import('@capacitor/push-notifications');
      const { setupPushListeners } = await import('./push-notifications');
      setupPushListeners();
      const call = vi
        .mocked(PushNotifications.addListener)
        .mock.calls.find((c) => c[0] === 'pushNotificationReceived');
      if (!call) throw new Error('pushNotificationReceived listener not registered');
      return call[1] as (notification: {
        title?: string;
        body?: string;
        data?: Record<string, string>;
        id: string;
      }) => void;
    }

    it('re-raises it as a local notification instead of swallowing it', async () => {
      // Android does not draw a push while the app is in the foreground, and this
      // listener was an empty TODO: the notification never reached the tray.
      const onReceived = await receivedListener();

      onReceived({
        id: 'p1',
        title: 'Nueva quedada',
        body: 'Cena el viernes',
        data: { type: 'new_event', eventId: '00000000-0000-0000-0000-000000000050' },
      });

      await vi.waitFor(() => {
        expect(localNotifications.schedule).toHaveBeenCalledWith({
          notifications: [
            expect.objectContaining({
              title: 'Nueva quedada',
              body: 'Cena el viernes',
              channelId: 'quedamos-push',
              extra: { type: 'new_event', eventId: '00000000-0000-0000-0000-000000000050' },
            }),
          ],
        });
      });
    });

    it('gives each one its own id', async () => {
      const onReceived = await receivedListener();

      onReceived({ id: 'p1', title: 'Una', data: {} });
      onReceived({ id: 'p2', title: 'Otra', data: {} });

      await vi.waitFor(() => {
        expect(localNotifications.schedule).toHaveBeenCalledTimes(2);
      });
      const ids = localNotifications.schedule.mock.calls.map(
        (call) => (call[0] as { notifications: Array<{ id: number }> }).notifications[0].id,
      );
      expect(new Set(ids).size).toBe(2);
    });

    it('falls back to the title and body inside data', async () => {
      const onReceived = await receivedListener();

      onReceived({ id: 'p1', data: { type: 'new_event', title: 'Desde data', body: 'Cuerpo' } });

      await vi.waitFor(() => {
        expect(localNotifications.schedule).toHaveBeenCalledWith({
          notifications: [expect.objectContaining({ title: 'Desde data', body: 'Cuerpo' })],
        });
      });
    });

    it('refreshes the widgets on a widget_refresh, and draws nothing', async () => {
      // The push is data-only and never has a title, so "nothing is drawn" would pass
      // with no code at all: the refresh is the assertion that matters.
      const onReceived = await receivedListener();

      onReceived({ id: 'p1', data: { type: 'widget_refresh', groupId: 'g1' } });

      await vi.waitFor(() => {
        expect(widgetBridge.notifyWidgetDataChanged).toHaveBeenCalled();
      });
      expect(localNotifications.schedule).not.toHaveBeenCalled();
    });

    it('does not refresh the widgets for an ordinary push', async () => {
      const onReceived = await receivedListener();

      onReceived({ id: 'p1', title: 'Nueva quedada', data: { type: 'new_event' } });

      await vi.waitFor(() => {
        expect(localNotifications.schedule).toHaveBeenCalled();
      });
      expect(widgetBridge.notifyWidgetDataChanged).not.toHaveBeenCalled();
    });

    it('shows nothing when there is no title to show', async () => {
      const onReceived = await receivedListener();

      onReceived({ id: 'p1', data: { type: 'new_event' } });

      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(localNotifications.schedule).not.toHaveBeenCalled();
    });

    it('gives up quietly when the user refuses the permission', async () => {
      localNotifications.checkPermissions.mockResolvedValue({ display: 'denied' });
      localNotifications.requestPermissions.mockResolvedValue({ display: 'denied' });
      const onReceived = await receivedListener();

      onReceived({ id: 'p1', title: 'Nueva quedada', data: {} });

      await vi.waitFor(() => {
        expect(localNotifications.requestPermissions).toHaveBeenCalled();
      });
      expect(localNotifications.schedule).not.toHaveBeenCalled();
    });

    it('creates the Android channel with a localized name', async () => {
      await receivedListener();

      await vi.waitFor(() => {
        expect(localNotifications.createChannel).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'quedamos-push',
            name: 'push.channelName',
            description: 'push.channelDescription',
          }),
        );
      });
    });

    it('routes a tap on it exactly like a tap on a background push', async () => {
      await receivedListener();

      await vi.waitFor(() => {
        expect(localNotifications.addListener).toHaveBeenCalledWith(
          'localNotificationActionPerformed',
          expect.any(Function),
        );
      });
      const call = localNotifications.addListener.mock.calls.find(
        (c) => c[0] === 'localNotificationActionPerformed',
      );
      const onTap = call![1] as (action: {
        notification: { extra?: Record<string, string> };
      }) => void;

      onTap({
        notification: {
          extra: { type: 'role_changed', groupId: '00000000-0000-0000-0000-000000000051' },
        },
      });

      expect(hrefSetter).toHaveBeenCalledWith('/tabs/group/00000000-0000-0000-0000-000000000051');
    });

    it('never navigates for a type with no screen behind it', async () => {
      await receivedListener();

      await vi.waitFor(() => {
        expect(localNotifications.addListener).toHaveBeenCalledWith(
          'localNotificationActionPerformed',
          expect.any(Function),
        );
      });
      const call = localNotifications.addListener.mock.calls.find(
        (c) => c[0] === 'localNotificationActionPerformed',
      );
      const onTap = call![1] as (action: {
        notification: { extra?: Record<string, string> };
      }) => void;

      onTap({
        notification: {
          extra: { type: 'widget_refresh', groupId: '00000000-0000-0000-0000-000000000051' },
        },
      });

      expect(hrefSetter).not.toHaveBeenCalled();
    });
  });

  describe('registerWeb service worker registration', () => {
    let register: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
      vi.stubEnv('VITE_FIREBASE_VAPID_KEY', 'vapid-key');
      vi.stubEnv('VITE_FIREBASE_API_KEY', 'key');
      vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', 'app.firebaseapp.com');
      vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'app-1');
      vi.stubEnv('VITE_FIREBASE_MESSAGING_SENDER_ID', '123');
      vi.stubEnv('VITE_FIREBASE_APP_ID', '1:123:web:abc');

      vi.stubGlobal('Notification', {
        permission: 'granted',
        requestPermission: vi.fn().mockResolvedValue('granted'),
      });
      vi.mocked(getFirebaseMessaging).mockResolvedValue({ fake: 'messaging' } as never);
      register = vi.fn().mockResolvedValue({});
      Object.defineProperty(navigator, 'serviceWorker', {
        value: { register, ready: Promise.resolve({ scope: '/' }) },
        configurable: true,
      });
    });

    afterEach(() => {
      vi.unstubAllEnvs();
      Reflect.deleteProperty(navigator, 'serviceWorker');
    });

    it('forwards the Firebase config in the query string so the worker has no copy of its own', async () => {
      const { getToken } = await import('firebase/messaging');
      vi.mocked(getToken).mockResolvedValue('web-token');

      await registerForPush();

      expect(register).toHaveBeenCalledTimes(1);
      const [url] = register.mock.calls[0] as [string];
      expect(url.startsWith('/firebase-messaging-sw.js?')).toBe(true);
      const params = new URLSearchParams(url.slice(url.indexOf('?')));
      expect(params.get('apiKey')).toBe('key');
      expect(params.get('projectId')).toBe('app-1');
      expect(params.get('messagingSenderId')).toBe('123');
      expect(params.get('appId')).toBe('1:123:web:abc');
      expect(params.get('authDomain')).toBe('app.firebaseapp.com');
    });

    it('warns instead of giving up in silence when the VAPID key is missing', async () => {
      vi.stubEnv('VITE_FIREBASE_VAPID_KEY', '');
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { token } = await registerForPush();

      expect(token).toBeNull();
      expect(register).not.toHaveBeenCalled();
      expect(String(warn.mock.calls[0]?.[0])).toContain('VITE_FIREBASE_VAPID_KEY');
      warn.mockRestore();
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
