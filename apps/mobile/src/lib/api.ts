import { supabase } from './supabase';

const API_URL = import.meta.env.VITE_API_URL;

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Called when the API answers 401 and refreshing the session didn't help.
 *
 * Registered from the app root (`useSessionExpiry`) instead of imported here: the
 * auth store already imports this module, so reaching back into it would close an
 * import cycle, and showing the toast needs React anyway.
 */
type SessionExpiredHandler = () => void;

let sessionExpiredHandler: SessionExpiredHandler | null = null;
let sessionExpiredNotified = false;

export function setSessionExpiredHandler(handler: SessionExpiredHandler | null): void {
  sessionExpiredHandler = handler;
}

/** Only for tests: forgets that an expiry was already reported. */
export function resetSessionExpiredNotice(): void {
  sessionExpiredNotified = false;
}

/**
 * Reports the dead session once, not once per pending request.
 *
 * The latch is also what keeps this from looping: signing out unregisters the push
 * token through this very client, so the handler's own request comes back 401 too
 * and would call the handler again. It is released as soon as any request succeeds
 * — that is, once somebody is signed in again.
 */
function notifySessionExpired(): void {
  if (sessionExpiredNotified) return;
  sessionExpiredNotified = true;
  sessionExpiredHandler?.();
}

let refreshInFlight: Promise<string | null> | null = null;

/**
 * Refreshes the Supabase session, one refresh at a time.
 *
 * A screen fires several requests at once, so a burst of 401s arrives together: they
 * all wait on the same refresh instead of racing to rotate the refresh token, which
 * Supabase would reject for every caller but the first.
 */
async function refreshAccessToken(): Promise<string | null> {
  refreshInFlight ??= supabase.auth
    .refreshSession()
    .then(({ data, error }) => (error ? null : (data.session?.access_token ?? null)))
    .catch(() => null)
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

async function getAuthToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {},
  allowRetry = true,
): Promise<T> {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  // A 401 while we did send a token means the backend rejected THIS session: either
  // an access token that expired before Supabase rotated it, or a session that is
  // gone for good. One refresh and one replay tell the two apart. With no token
  // there is no session to expire, so the 401 travels on as a plain error instead
  // of signing anybody out.
  if (response.status === 401 && token) {
    if (allowRetry) {
      const refreshed = await refreshAccessToken();
      if (refreshed) return fetchApi<T>(endpoint, options, false);
    }
    notifySessionExpired();
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Error' }));
    throw new ApiError(error.message || 'API Error', response.status);
  }

  sessionExpiredNotified = false;

  if (response.status === 204) {
    return null as T;
  }

  return response.json();
}

export const api = {
  get: <T>(endpoint: string) => fetchApi<T>(endpoint),
  post: <T>(endpoint: string, body: unknown) =>
    fetchApi<T>(endpoint, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(endpoint: string, body: unknown) =>
    fetchApi<T>(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(endpoint: string, body: unknown) =>
    fetchApi<T>(endpoint, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(endpoint: string, body?: unknown) =>
    fetchApi<T>(endpoint, {
      method: 'DELETE',
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }),
};
