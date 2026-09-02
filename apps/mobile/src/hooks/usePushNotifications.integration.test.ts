import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { usePushNotifications } from './usePushNotifications';
import { api } from '../lib/api';
import { App as CapApp } from '@capacitor/app';

// Unlike usePushNotifications.test.ts, this file does NOT mock ../lib/push-notifications
// — it exercises the REAL registerForPush()/registerNative() against a hand-rolled fake
// of the Capacitor plugin. The native double-POST-on-resume bug lived entirely in the
// interplay between the hook's unconditional resend and the lib's long-lived rotation
// listener; mocking the lib away (as the unit test file does, by design, for isolation)
// makes that interplay untestable. This file is the regression guard for it.

vi.mock('../stores/auth', () => ({
  useAuthStore: vi.fn((selector: (state: { user: { id: string } | undefined }) => unknown) =>
    selector({ user: { id: 'user-1' } }),
  ),
}));

vi.mock('../lib/api', () => ({
  api: {
    post: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    get: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
  },
}));

vi.mock('../lib/firebase', () => ({
  getFirebaseMessaging: vi.fn().mockResolvedValue(null),
}));

vi.mock('firebase/messaging', () => ({
  getToken: vi.fn(),
  onMessage: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn().mockReturnValue(true),
  },
}));

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }),
  },
}));

// Minimal fake of the native plugin's event dispatch: every addListener() call is
// recorded with a "removed" flag flipped by its returned handle's remove(). Firing a
// 'registration' event invokes every currently-live (non-removed) listener for that
// event, mirroring how the real Capacitor plugin dispatches one native event to every
// attached listener — which is exactly the mechanism the double-POST bug depended on
// (two listener batches briefly alive at once during a resume).
interface ListenerEntry {
  event: string;
  callback: (arg: unknown) => void;
  removed: boolean;
}

const listenerEntries = vi.hoisted((): ListenerEntry[] => []);

vi.mock('@capacitor/push-notifications', () => ({
  PushNotifications: {
    addListener: vi.fn((event: string, callback: (arg: unknown) => void) => {
      const entry: ListenerEntry = { event, callback, removed: false };
      listenerEntries.push(entry);
      return Promise.resolve({
        remove: () => {
          entry.removed = true;
        },
      });
    }),
    requestPermissions: vi.fn().mockResolvedValue({ receive: 'granted' }),
    register: vi.fn().mockResolvedValue(undefined),
  },
}));

function fireNativeRegistration(value: string): void {
  listenerEntries
    .filter((entry) => entry.event === 'registration' && !entry.removed)
    .forEach((entry) => entry.callback({ value }));
}

function liveListenerCount(event: string): number {
  return listenerEntries.filter((entry) => entry.event === event && !entry.removed).length;
}

function getAppStateChangeCallback(): (state: { isActive: boolean }) => void {
  const call = vi.mocked(CapApp.addListener).mock.calls.find((c) => c[0] === 'appStateChange');
  if (!call) throw new Error('appStateChange listener was not registered');
  return call[1] as (state: { isActive: boolean }) => void;
}

describe('usePushNotifications (integration against the real lib/push-notifications)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listenerEntries.length = 0;
  });

  it('posts the token exactly once per native resume, even though two registration listeners are briefly attached at once', async () => {
    renderHook(() => usePushNotifications());

    // Initial registration: real registerNative() adds a 'registration' listener and
    // awaits it via the plugin's register() call.
    await waitFor(() => expect(liveListenerCount('registration')).toBe(1));
    fireNativeRegistration('token-1');

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect(api.post).toHaveBeenCalledWith('/notifications/register-token', {
      token: 'token-1',
      platform: 'android',
    });

    // Resume: the hook re-runs registerForPush(), which adds a SECOND 'registration'
    // listener. cleanupRef.current?.() only removes the first one AFTER this second
    // call resolves, so both are live at once here — the exact window the double-POST
    // bug lived in.
    const onAppStateChange = getAppStateChangeCallback();
    onAppStateChange({ isActive: true });

    await waitFor(() => expect(liveListenerCount('registration')).toBe(2));

    // Same token delivered again — a plain resume, not a real FCM rotation. Both the
    // old (rotation-branch) and new (hook-resolves-and-resends) listeners see this
    // single simulated native event.
    fireNativeRegistration('token-1');

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
    // Let any stray extra POST land before asserting the ceiling — pre-fix, a third
    // call (from the old listener's rotation branch treating the unchanged token as a
    // rotation) would show up here.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(api.post).toHaveBeenCalledTimes(2);

    // The old listener pair was removed once the resume's registerForPush() resolved.
    expect(liveListenerCount('registration')).toBe(1);
  });
});
