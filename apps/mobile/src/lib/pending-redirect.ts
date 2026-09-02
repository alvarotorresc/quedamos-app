import { safeRedirect } from './safe-redirect';

/** Exported so tests can plant (and inspect) a stored destination directly. */
export const PENDING_REDIRECT_KEY = 'pendingRedirect';

/**
 * An invite parked before signing up is only worth resuming for a day: after that
 * the link is stale enough that jumping there would feel like a hijack.
 */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface StoredRedirect {
  path: string;
  savedAt: number;
}

/** Narrows anything to an in-app path, or null when it isn't one. */
function toSafePath(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  return safeRedirect(raw, '') || null;
}

/**
 * Parks where the user was heading before the auth detour.
 *
 * The confirmation email opens the app from scratch (new tab, or a cold start on
 * Android), so the `?redirect=` parameter that carried the invite is long gone by
 * the time the session exists. localStorage is the only channel that survives that
 * trip. Anything that isn't a path inside this app is dropped, so a crafted invite
 * link can't turn into an open redirect after login.
 */
export function savePendingRedirect(path: string | null | undefined): void {
  const safe = toSafePath(path);
  if (!safe) return;
  const entry: StoredRedirect = { path: safe, savedAt: Date.now() };
  try {
    localStorage.setItem(PENDING_REDIRECT_KEY, JSON.stringify(entry));
  } catch {
    // Private mode or a full quota: the invite just won't survive the trip.
  }
}

export function clearPendingRedirect(): void {
  try {
    localStorage.removeItem(PENDING_REDIRECT_KEY);
  } catch {
    // Nothing to do: reading it back will fail the same way and yield null.
  }
}

/**
 * Reads the parked destination and drops it, so it is resumed exactly once.
 *
 * Returns null when there is nothing stored, when it expired, when the stored
 * value is corrupt, or when it was tampered with into something outside the app.
 */
export function takePendingRedirect(): string | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(PENDING_REDIRECT_KEY);
  } catch {
    return null;
  }

  clearPendingRedirect();
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { path, savedAt } = parsed as Partial<StoredRedirect>;
    if (typeof savedAt !== 'number' || Date.now() - savedAt > MAX_AGE_MS) return null;
    return toSafePath(path);
  } catch {
    return null;
  }
}
