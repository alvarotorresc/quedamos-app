import { useEffect, useRef } from 'react';
import { useAuthStore } from '../stores/auth';
import {
  registerForPush,
  sendTokenToBackend,
  setupPushListeners,
} from '../lib/push-notifications';

export function usePushNotifications() {
  const user = useAuthStore((s) => s.user);
  const initialized = useRef(false);

  useEffect(() => {
    if (!user || initialized.current) return;
    initialized.current = true;

    (async () => {
      try {
        setupPushListeners();
        console.log('[Push] Registering for push notifications...');
        const token = await registerForPush();
        if (token) {
          console.log('[Push] Token obtained:', token.slice(0, 20) + '...');
          await sendTokenToBackend(token);
          console.log('[Push] Token registered in backend');
        } else {
          console.warn('[Push] No token obtained (permission denied or unsupported)');
        }
      } catch (err) {
        console.error('[Push] Error:', err);
      }
    })();
  }, [user]);
}
