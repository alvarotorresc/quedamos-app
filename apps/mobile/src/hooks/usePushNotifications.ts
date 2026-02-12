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

  useEffect(() => {
    if (!user || registered.current) return;

    (async () => {
      try {
        setupPushListeners();
        setupWebForegroundHandler();
        console.log('[Push] Registering for push notifications...');
        const token = await registerForPush();
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
  }, [user]);
}
