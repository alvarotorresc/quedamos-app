import { Capacitor } from '@capacitor/core';
import { initializeApp } from 'firebase/app';
import { getMessaging, isSupported, Messaging } from 'firebase/messaging';
import {
  getAnalytics,
  isSupported as isAnalyticsSupported,
  logEvent as firebaseLogEvent,
  Analytics,
} from 'firebase/analytics';
import { getFirebaseWebConfig } from './env';

let app: ReturnType<typeof initializeApp> | null = null;

function getApp() {
  if (!app) {
    // Read through lib/env, the single reader of import.meta.env — the messaging service
    // worker gets the very same object forwarded as a query string, so there is only one
    // copy of this config in the codebase.
    app = initializeApp(getFirebaseWebConfig());
  }
  return app;
}

let messagingInstance: Messaging | null = null;

export async function getFirebaseMessaging(): Promise<Messaging | null> {
  if (messagingInstance) return messagingInstance;

  const supported = await isSupported();
  if (!supported) return null;

  messagingInstance = getMessaging(getApp());
  return messagingInstance;
}

let analyticsPromise: Promise<Analytics | null> | null = null;

type UmamiTracker = { track: (name: string, data?: Record<string, unknown>) => void };

/**
 * Firebase Analytics only on the native app. On the web it would load gtag,
 * which the CSP blocks, and Umami (index.html) already covers page views and
 * custom events there.
 */
export function getFirebaseAnalytics(): Promise<Analytics | null> {
  if (!Capacitor.isNativePlatform()) return Promise.resolve(null);
  if (!analyticsPromise) {
    analyticsPromise = isAnalyticsSupported().then((supported) => {
      if (!supported) return null;
      return getAnalytics(getApp());
    });
  }
  return analyticsPromise;
}

export async function logEvent(
  eventName: string,
  params?: Record<string, string | number | boolean>,
): Promise<void> {
  try {
    if (!Capacitor.isNativePlatform()) {
      (window as Window & { umami?: UmamiTracker }).umami?.track(eventName, params);
      return;
    }
    const analytics = await getFirebaseAnalytics();
    if (!analytics) return;
    firebaseLogEvent(analytics, eventName, params);
  } catch {
    // Analytics failures must never break the app
  }
}
