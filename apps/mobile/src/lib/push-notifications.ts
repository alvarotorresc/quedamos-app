import { Capacitor } from '@capacitor/core';
import { PushNotifications, type PushNotificationSchema } from '@capacitor/push-notifications';
import { getToken, onMessage } from 'firebase/messaging';
import { getFirebaseMessaging } from './firebase';
import { readEnv, firebaseSwConfigParams } from './env';
import { resolvePushRoute } from './push-routes';
import { api } from './api';

let currentToken: string | null = null;
let webForegroundSetup = false;
let nativePushSetup = false;

export function getCurrentToken(): string | null {
  return currentToken;
}

export function setCurrentToken(token: string | null): void {
  currentToken = token;
}

export function resetNativePushSetup(): void {
  nativePushSetup = false;
}

/**
 * Register for push notifications on the current platform.
 * Returns an object with the token and a cleanup function to remove listeners.
 * The cleanup function MUST be called on unmount to prevent memory leaks
 * from accumulated Capacitor listeners.
 */
export async function registerForPush(): Promise<{
  token: string | null;
  cleanup: () => void;
}> {
  if (Capacitor.isNativePlatform()) {
    return registerNative();
  }
  const token = await registerWeb();
  return { token, cleanup: () => {} };
}

async function registerNative(): Promise<{
  token: string | null;
  cleanup: () => void;
}> {
  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== 'granted') {
    return { token: null, cleanup: () => {} };
  }

  // Deferred promise so we can await listeners before calling register().
  // This lets us capture PluginListenerHandle refs for proper cleanup,
  // preventing listener accumulation when the hook unmounts/remounts.
  let resolveToken: (value: string | null) => void;
  const tokenPromise = new Promise<string | null>((resolve) => {
    resolveToken = resolve;
  });

  let initialTokenReceived = false;

  const registrationHandle = await PushNotifications.addListener('registration', (t) => {
    const previousToken = currentToken;
    currentToken = t.value;

    if (!initialTokenReceived) {
      initialTokenReceived = true;
      resolveToken(t.value);
      return;
    }

    // FCM rotated the token after the initial registration (e.g. token expiry or app
    // reinstall) — or a resume re-ran registerNative() while this listener was still
    // attached (it's only removed once the NEW registerNative() call resolves), so the
    // same native event can reach this branch with a token that hasn't actually
    // changed. Only resend when it did: on native, the hook itself unconditionally
    // resends whatever token IT resolves with on every resume, so resending an
    // unchanged token here too would double-POST for a single resume.
    if (t.value === previousToken) return;

    // The endpoint is an idempotent upsert (UNIQUE(user_id, token)), so re-sending is
    // always safe.
    void sendTokenToBackend(t.value).catch((err) => {
      if (import.meta.env.DEV) {
        console.error('[Push] Failed to resend rotated token:', err);
      }
    });
  });

  const errorHandle = await PushNotifications.addListener('registrationError', (error) => {
    if (import.meta.env.DEV) {
      console.error('[Push] Native registration error:', error);
    }
    // Settle the promise even though no token arrived, so a LATER real 'registration'
    // event (e.g. a retry after this error) is treated as a resend instead of routed
    // into the (already-resolved) initial-token branch above, where resolveToken()
    // would silently no-op on an already-settled promise and the token would vanish.
    initialTokenReceived = true;
    resolveToken(null);
  });

  const cleanup = () => {
    registrationHandle.remove();
    errorHandle.remove();
  };

  try {
    await PushNotifications.register();
    const token = await tokenPromise;
    return { token, cleanup };
  } catch (err) {
    // register() (or, in principle, awaiting tokenPromise) threw after the listeners
    // were already attached above — without this, registerNative() throws before ever
    // returning a cleanup function, and the caller has no way to remove the handles it
    // never received. Tear them down here instead of leaking them.
    cleanup();
    throw err;
  }
}

async function registerWeb(): Promise<string | null> {
  if (!('Notification' in window)) return null;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;

  const messaging = await getFirebaseMessaging();
  if (!messaging) return null;

  const vapidKey = readEnv('VITE_FIREBASE_VAPID_KEY');
  if (!vapidKey) {
    // Used to be a silent `return null`, indistinguishable from "the user said no": the
    // whole web push flow stopped here with nothing in the console. Unconditional, same
    // reasoning as warnMissingEnvVars() — a build deployed without the key looks fine.
    console.warn('[Push] VITE_FIREBASE_VAPID_KEY is missing: web push stays disabled.');
    return null;
  }

  // The config travels in the query string so public/firebase-messaging-sw.js has no
  // hardcoded copy of its own; the worker reads it back from self.location.search. The
  // query does not change the registration scope (still '/'), and a different config
  // registers a different script URL, which is exactly the invalidation we want.
  const swQuery = firebaseSwConfigParams();
  await navigator.serviceWorker.register(
    swQuery ? `/firebase-messaging-sw.js?${swQuery}` : '/firebase-messaging-sw.js',
  );
  const registration = await navigator.serviceWorker.ready;

  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: registration,
  });

  currentToken = token;
  return token;
}

export async function sendTokenToBackend(token: string): Promise<void> {
  const platform = Capacitor.isNativePlatform() ? 'android' : 'web';
  await api.post('/notifications/register-token', { token, platform });
}

export async function unregisterFromBackend(): Promise<void> {
  if (!currentToken) return;
  try {
    await api.delete('/notifications/unregister-token', {
      token: currentToken,
    });
  } catch {
    // Ignore errors during unregister
  }
  currentToken = null;
}

/** Android channel the re-emitted foreground notifications go through. */
const LOCAL_CHANNEL_ID = 'quedamos-push';

let localNotificationSeq = 0;

/** Local notification ids must be 32-bit ints and unique among the pending ones. */
function nextLocalNotificationId(): number {
  localNotificationSeq = (localNotificationSeq % 2147483000) + 1;
  return localNotificationSeq;
}

type LocalNotificationsPlugin = (typeof import('@capacitor/local-notifications'))['LocalNotifications'];

let localNotificationsLoad: Promise<{ plugin: LocalNotificationsPlugin } | null> | null = null;

/**
 * Imported on demand rather than at the top of the module: this file is also loaded by web
 * builds and by test suites that stub `@capacitor/core` down to `isNativePlatform`, where
 * registering a native plugin at import time would throw before anything ran.
 *
 * The plugin comes back wrapped in an object, never bare: Capacitor's registerPlugin
 * returns a Proxy that answers to ANY property, `then` included, so resolving a promise
 * with it makes the runtime treat it as a thenable and call `LocalNotifications.then()` —
 * a native method that does not exist.
 */
function loadLocalNotifications(): Promise<{ plugin: LocalNotificationsPlugin } | null> {
  localNotificationsLoad ??= import('@capacitor/local-notifications')
    .then((module) => ({ plugin: module.LocalNotifications }))
    .catch((err: unknown) => {
      if (import.meta.env.DEV) {
        console.error('[Push] LocalNotifications plugin unavailable:', err);
      }
      return null;
    });
  return localNotificationsLoad;
}

/**
 * Create the Android channel and listen for taps on the notifications we raise
 * ourselves. The channel name is localized through the app's own i18n — Android caches
 * it, so a language change shows up on the next launch, which is when this runs again.
 */
async function setupLocalNotifications(): Promise<void> {
  const loaded = await loadLocalNotifications();
  if (!loaded) return;
  const localNotifications = loaded.plugin;

  try {
    const { default: i18n } = await import('../i18n');
    await localNotifications.createChannel({
      id: LOCAL_CHANNEL_ID,
      name: i18n.t('push.channelName'),
      description: i18n.t('push.channelDescription'),
      importance: 4,
      visibility: 1,
    });

    await localNotifications.addListener('localNotificationActionPerformed', (action) => {
      // The local equivalent of a push's `data`: whatever we put in `extra` below.
      const data = action.notification.extra as Record<string, string> | undefined;
      if (!data?.type) return;
      navigateFromPush(data);
    });
  } catch (err) {
    if (import.meta.env.DEV) {
      console.error('[Push] Could not set up local notifications:', err);
    }
  }
}

/**
 * Android does not draw a push that arrives while the app is in the foreground — the
 * system hands it to the app instead, and this listener used to be an empty TODO, so the
 * notification simply never appeared. Re-raise it as a local notification carrying the
 * same title, body and data, so it reaches the tray and its tap routes exactly like a
 * background one.
 */
async function showForegroundPush(notification: PushNotificationSchema): Promise<void> {
  const data = (notification.data ?? {}) as Record<string, string>;
  const title = notification.title ?? data.title;
  const body = notification.body ?? data.body ?? '';
  if (!title) return;

  const loaded = await loadLocalNotifications();
  if (!loaded) return;
  const localNotifications = loaded.plugin;

  try {
    let permission = await localNotifications.checkPermissions();
    if (permission.display !== 'granted') {
      permission = await localNotifications.requestPermissions();
    }
    if (permission.display !== 'granted') return;

    await localNotifications.schedule({
      notifications: [
        {
          id: nextLocalNotificationId(),
          title,
          body,
          channelId: LOCAL_CHANNEL_ID,
          extra: data,
        },
      ],
    });
  } catch (err) {
    if (import.meta.env.DEV) {
      console.error('[Push] Could not show a foreground notification:', err);
    }
  }
}

export function setupPushListeners(): void {
  if (nativePushSetup) return;
  if (!Capacitor.isNativePlatform()) return;
  nativePushSetup = true;

  void setupLocalNotifications();

  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    void showForegroundPush(notification);
  });

  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const data = action.notification.data;
    if (!data?.type) return;

    navigateFromPush(data);
  });
}

const GROUP_STORAGE_KEY = 'quedamos_current_group_id';

/**
 * Open whatever the notification points at. The type -> screen table lives in
 * `push-routes.ts`, shared (by hand, and checked by its test) with the service worker's
 * notificationclick handler.
 */
function navigateFromPush(data: Record<string, string>): void {
  const route = resolvePushRoute(data);

  // Only after resolving, and only for a group you are still in: this used to run
  // unconditionally before looking at the type, so member_kicked / group_deleted stored
  // the id of a group you had just been thrown out of as "the current group".
  if (route.persistGroupId) {
    localStorage.setItem(GROUP_STORAGE_KEY, route.persistGroupId);
  } else if (route.forgetGroupId && localStorage.getItem(GROUP_STORAGE_KEY) === route.forgetGroupId) {
    localStorage.removeItem(GROUP_STORAGE_KEY);
  }

  window.location.href = route.url;
}

/**
 * Show a foreground notification, preferring the service worker's registration.
 *
 * Chrome on Android throws from the `new Notification(...)` constructor
 * ("Illegal constructor" — persistent notifications only), so a registration is
 * asked first when there is one; clicks then reach the service worker's
 * `notificationclick` handler, which routes off the same `data` fields as
 * `navigateFromPush`. The constructor stays as the fallback for the browsers
 * that have no service worker (or whose registration refused), and only there
 * does the page-level onclick apply.
 */
function showForegroundNotification(
  title: string,
  options: NotificationOptions,
  data: Record<string, string> | undefined,
): void {
  const openViaConstructor = () => {
    try {
      const notification = new Notification(title, options);
      notification.onclick = () => {
        window.focus();
        if (data?.type) {
          navigateFromPush(data);
        }
        notification.close();
      };
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('[Push] Could not show a foreground notification:', err);
      }
    }
  };

  // Read synchronously: browsers without service workers must not wait a tick.
  const ready = navigator.serviceWorker?.ready;
  if (!ready) {
    openViaConstructor();
    return;
  }

  void ready.then((registration) => registration.showNotification(title, options)).catch(
    openViaConstructor,
  );
}

/**
 * Set up web foreground message handler.
 * When the browser tab is in the foreground, the service worker's
 * onBackgroundMessage does NOT fire - we need onMessage instead.
 */
export function setupWebForegroundHandler(): void {
  if (Capacitor.isNativePlatform() || webForegroundSetup) return;
  webForegroundSetup = true;

  getFirebaseMessaging().then((messaging) => {
    if (!messaging) return;

    onMessage(messaging, (payload) => {
      // Web tokens now receive a data-only payload (no top-level `notification`) — the
      // backend splits sends by platform to avoid @firebase/messaging showing its own
      // duplicate notification. Read title/body from `data` first, with a fallback to
      // `notification` for resilience during rollout (old backend + new client).
      const data = payload.data as Record<string, string> | undefined;
      const title = data?.title ?? payload.notification?.title;
      const body = data?.body ?? payload.notification?.body;
      if (title && 'Notification' in window && Notification.permission === 'granted') {
        showForegroundNotification(title, { body: body ?? '', icon: '/logo.png', data }, data);
      }
    });
  });
}
