import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { useAuthStore } from '../stores/auth';
import {
  registerForPush,
  sendTokenToBackend,
  setupPushListeners,
  setupWebForegroundHandler,
} from '../lib/push-notifications';

export function usePushNotifications() {
  const user = useAuthStore((s) => s.user);
  const cleanupRef = useRef<(() => void) | null>(null);
  // Web has no onTokenRefresh in the modular Firebase SDK, so re-obtaining the token on
  // resume is the only way to detect rotation there. Tracked across resumes (not reset
  // per attempt) so an unchanged token isn't resent on every tab focus.
  const lastSentTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) return;

    // `cancelled`/`inFlight` are closures local to THIS effect invocation on purpose,
    // not refs: React StrictMode double-invokes this effect (mount -> cleanup -> mount)
    // and a ref would latch "in flight" from the aborted first mount, permanently
    // blocking the surviving second mount's registration.
    let cancelled = false;
    let inFlight = false;
    const isNative = Capacitor.isNativePlatform();

    async function register(): Promise<void> {
      if (inFlight) return;
      inFlight = true;
      try {
        setupPushListeners();
        setupWebForegroundHandler();
        const { token, cleanup } = await registerForPush();

        // If the effect was cleaned up while we were awaiting, remove
        // the listeners immediately to avoid orphaned handlers.
        if (cancelled) {
          cleanup();
          return;
        }

        // Every call to registerForPush() sets up fresh native listeners. Remove the
        // previous batch before replacing the ref, or repeated resumes accumulate
        // orphaned 'registration'/'registrationError' listeners.
        cleanupRef.current?.();
        cleanupRef.current = cleanup;

        if (token) {
          // Native: the backend endpoint is an idempotent upsert (UNIQUE(user_id, token)),
          // so resending on every resume is safe and cheap, and it also covers the case
          // where a previous send failed silently. Web: only resend when the token
          // actually changed (or was never sent), to avoid a redundant POST on every tab
          // focus when nothing rotated.
          if (isNative || token !== lastSentTokenRef.current) {
            await sendTokenToBackend(token);
          }
          lastSentTokenRef.current = token;
        } else if (import.meta.env.DEV) {
          console.warn('[Push] No token obtained (permission denied or unsupported)');
        }
      } catch (err) {
        if (import.meta.env.DEV) {
          console.error('[Push] Error:', err);
        }
        // Don't touch lastSentTokenRef here so a failed send retries with the same
        // token on the next resume instead of being treated as "already sent".
      } finally {
        inFlight = false;
      }
    }

    void register();

    let removeResumeListener: (() => void) | null = null;

    if (isNative) {
      const listenerPromise = CapApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive) void register();
      });
      removeResumeListener = () => {
        void listenerPromise.then((handle) => handle.remove());
      };
    } else {
      const onVisibilityChange = () => {
        // Only retry once permission is already 'granted'. Calling registerForPush()
        // (and therefore Notification.requestPermission()) while permission is still
        // 'default' would re-prompt the user every time the tab regains focus instead
        // of just retrying a previously-granted registration.
        if (
          document.visibilityState === 'visible' &&
          'Notification' in window &&
          Notification.permission === 'granted'
        ) {
          void register();
        }
      };
      document.addEventListener('visibilitychange', onVisibilityChange);
      removeResumeListener = () => document.removeEventListener('visibilitychange', onVisibilityChange);
    }

    return () => {
      cancelled = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
      removeResumeListener?.();
    };
  }, [user]);
}
