import { initializeApp } from 'firebase/app';
import { getMessaging, isSupported, Messaging } from 'firebase/messaging';
import {
  getAnalytics,
  isSupported as isAnalyticsSupported,
  logEvent as firebaseLogEvent,
  Analytics,
} from 'firebase/analytics';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

let app: ReturnType<typeof initializeApp> | null = null;

function getApp() {
  if (!app) {
    app = initializeApp(firebaseConfig);
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

export function getFirebaseAnalytics(): Promise<Analytics | null> {
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
    const analytics = await getFirebaseAnalytics();
    if (!analytics) return;
    firebaseLogEvent(analytics, eventName, params);
  } catch {
    // Analytics failures must never break the app
  }
}
