import { useEffect, useRef } from 'react';
import { setSessionExpiredHandler } from '../lib/api';
import { useAuthStore } from '../stores/auth';
import { useToast } from './useToast';

/**
 * Turns a session the backend no longer accepts into something the user can read.
 *
 * Without this a 401 from the API is just another `errors.generic` toast and the
 * app keeps pretending there is a session: every screen then fails on its own. The
 * handler lives in `lib/api` (registered once from the root, cleared on unmount) so
 * the fetch layer can reach it without importing React or the auth store.
 */
export function useSessionExpiry(): void {
  const { showError } = useToast();
  const signOut = useAuthStore((s) => s.signOut);

  // The toast helper and the store action are fresh on every render; read through a
  // ref so the registration below runs once instead of re-registering constantly.
  const latest = useRef({ showError, signOut });
  useEffect(() => {
    latest.current = { showError, signOut };
  });

  useEffect(() => {
    setSessionExpiredHandler(() => {
      latest.current.showError('errors.sessionExpired');
      // signOut() clears the local session and drops the user, which sends the
      // router back to the splash. A failing sign-out must not become an unhandled
      // rejection on top of an already-broken session.
      void latest.current.signOut().catch(() => {});
    });
    return () => setSessionExpiredHandler(null);
  }, []);
}
