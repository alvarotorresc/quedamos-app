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

  const registrationHandle = await PushNotifications.addListener('registration', (t) => {
    currentToken = t.value;
    resolveToken(t.value);
  });

  const errorHandle = await PushNotifications.addListener('registrationError', (error) => {
    console.error('[Push] Native registration error:', error);
    resolveToken(null);
  });

  await PushNotifications.register();

  const token = await tokenPromise;

  return {
    token,
    cleanup: () => {
      registrationHandle.remove();
      errorHandle.remove();
    },
  };
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

  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    console.log('[Push] Received in foreground:', notification);
    // On Android, foreground notifications are not shown automatically.
    // The notification object contains title/body but needs a local notification
    // plugin to display as a system notification. For now, we log it.
  });

  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    console.log('[Push] Action performed:', action);
    const data = action.notification.data;
    if (!data?.type) return;

    navigateFromPush(data);
  });
}

const GROUP_STORAGE_KEY = 'quedamos_current_group_id';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function navigateFromPush(data: Record<string, string>): void {
  const { type, groupId, eventId } = data;

  // Validate UUIDs before using in URLs or storage
  const validGroupId = groupId && UUID_RE.test(groupId) ? groupId : undefined;
  const validEventId = eventId && UUID_RE.test(eventId) ? eventId : undefined;

  if (validGroupId) {
    localStorage.setItem(GROUP_STORAGE_KEY, validGroupId);
  }

  if (type === 'member_joined' || type === 'member_left') {
    window.location.href = validGroupId ? `/tabs/group/${validGroupId}` : '/tabs/group';
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
      console.log('[Push] Web foreground message:', payload);
      const { title, body } = payload.notification ?? {};
      const data = payload.data as Record<string, string> | undefined;
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
