import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { getToken, onMessage } from 'firebase/messaging';
import { getFirebaseMessaging } from './firebase';
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

  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
  if (!vapidKey) return null;

  await navigator.serviceWorker.register('/firebase-messaging-sw.js');
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

export function setupPushListeners(): void {
  if (nativePushSetup) return;
  if (!Capacitor.isNativePlatform()) return;
  nativePushSetup = true;

  PushNotifications.addListener('pushNotificationReceived', (_notification) => {
    // On Android, foreground notifications are not shown automatically.
    // The notification object contains title/body but needs a local notification
    // plugin to display as a system notification. TODO: use LocalNotifications plugin.
  });

  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const data = action.notification.data;
    if (!data?.type) return;

    navigateFromPush(data);
  });
}

const GROUP_STORAGE_KEY = 'quedamos_current_group_id';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function navigateFromPush(data: Record<string, string>): void {
  const { type, groupId, eventId, pollId } = data;

  // Validate UUIDs before using in URLs or storage
  const validGroupId = groupId && UUID_RE.test(groupId) ? groupId : undefined;
  const validEventId = eventId && UUID_RE.test(eventId) ? eventId : undefined;

  if (validGroupId) {
    localStorage.setItem(GROUP_STORAGE_KEY, validGroupId);
  }

  if (type === 'member_joined' || type === 'member_left') {
    window.location.href = validGroupId ? `/tabs/group/${validGroupId}` : '/tabs/group';
  } else if (type === 'new_poll') {
    // poll_completed is informational only ("El aro se cierra") — its poll is already
    // `completed`, so the mazo can never focus/consume a pollId for it. Only an open
    // question (new_poll) gets the deep-link param.
    //
    // groupId travels alongside pollId (not just in localStorage above) because the
    // service worker's notificationclick path replicates this same routing but has no
    // access to the page's localStorage — the URL is the only channel that reaches it.
    // Each field validates independently: garbage in one must not suppress the other.
    const pollOk = typeof pollId === 'string' && UUID_RE.test(pollId);
    const pollParams = new URLSearchParams();
    if (pollOk) pollParams.set('pollId', pollId);
    if (validGroupId) pollParams.set('groupId', validGroupId);
    const pollQuery = pollParams.toString();
    window.location.href = pollQuery ? `/tabs/calendar?${pollQuery}` : '/tabs/calendar';
  } else if (type === 'poll_completed') {
    window.location.href = '/tabs/calendar';
  } else if (validEventId) {
    window.location.href = `/tabs/plans?eventId=${validEventId}`;
  } else {
    window.location.href = '/tabs/plans';
  }
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
        const notification = new Notification(title, {
          body: body ?? '',
          icon: '/logo.png',
          data,
        });
        notification.onclick = () => {
          window.focus();
          if (data?.type) {
            navigateFromPush(data);
          }
          notification.close();
        };
      }
    });
  });
}
