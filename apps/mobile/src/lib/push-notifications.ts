import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { getToken, onMessage } from 'firebase/messaging';
import { getFirebaseMessaging } from './firebase';
import { api } from './api';

let currentToken: string | null = null;
let webForegroundSetup = false;

export function getCurrentToken(): string | null {
  return currentToken;
}

export function setCurrentToken(token: string | null): void {
  currentToken = token;
}

export async function registerForPush(): Promise<string | null> {
  if (Capacitor.isNativePlatform()) {
    return registerNative();
  }
  return registerWeb();
}

async function registerNative(): Promise<string | null> {
  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== 'granted') return null;

  return new Promise((resolve) => {
    PushNotifications.addListener('registration', (token) => {
      currentToken = token.value;
      resolve(token.value);
    });

    PushNotifications.addListener('registrationError', (error) => {
      console.error('[Push] Native registration error:', error);
      resolve(null);
    });

    PushNotifications.register();
  });
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
  if (!Capacitor.isNativePlatform()) return;

  PushNotifications.addListener(
    'pushNotificationReceived',
    (notification) => {
      console.log('[Push] Received in foreground:', notification);
      // On Android, foreground notifications are not shown automatically.
      // The notification object contains title/body but needs a local notification
      // plugin to display as a system notification. For now, we log it.
    },
  );

  PushNotifications.addListener(
    'pushNotificationActionPerformed',
    (action) => {
      console.log('[Push] Action performed:', action);
      const data = action.notification.data;
      if (!data?.type) return;

      navigateFromPush(data);
    },
  );
}

const GROUP_STORAGE_KEY = 'quedamos_current_group_id';

function navigateFromPush(data: Record<string, string>): void {
  const { type, groupId, eventId } = data;

  if (groupId) {
    localStorage.setItem(GROUP_STORAGE_KEY, groupId);
  }

  if (type === 'member_joined' || type === 'member_left') {
    window.location.href = groupId ? `/tabs/group/${groupId}` : '/tabs/group';
  } else if (eventId) {
    window.location.href = `/tabs/plans?eventId=${eventId}`;
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
