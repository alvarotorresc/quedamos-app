import { useEffect, useRef } from 'react';
import { useAuthStore } from '../stores/auth';
import {
  registerForPush,
  sendTokenToBackend,
  setupPushListeners,
  setupWebForegroundHandler,
} from '../lib/push-notifications';

export function usePushNotifications() {
  const user = useAuthStore((s) => s.user);
  const registered = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!user || registered.current) return;

    let cancelled = false;

    (async () => {
      try {
        setupPushListeners();
        setupWebForegroundHandler();
        console.log('[Push] Registering for push notifications...');
        const { token, cleanup } = await registerForPush();

        // If the effect was cleaned up while we were awaiting, remove
        // the listeners immediately to avoid orphaned handlers.
        if (cancelled) {
          cleanup();
          return;
        }

        cleanupRef.current = cleanup;

        if (token) {
          console.log('[Push] Token obtained:', token.slice(0, 20) + '...');
          await sendTokenToBackend(token);
          console.log('[Push] Token registered in backend');
          registered.current = true;
        } else {
          console.warn('[Push] No token obtained (permission denied or unsupported)');
        }
      } catch (err) {
        console.error('[Push] Error:', err);
        // Don't set registered = true so it retries on next mount
      }
    })();

    return () => {
      cancelled = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [user]);
}
