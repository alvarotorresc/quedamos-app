import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { getToken } from 'firebase/messaging';
import { getFirebaseMessaging } from './firebase';
import { api } from './api';

let currentToken: string | null = null;

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

    PushNotifications.addListener('registrationError', () => {
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

  const registration = await navigator.serviceWorker.register(
    '/firebase-messaging-sw.js',
  );

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
      console.log('Push received in foreground:', notification);
    },
  );

  PushNotifications.addListener(
    'pushNotificationActionPerformed',
    (action) => {
      console.log('Push action performed:', action);
    },
  );
}
