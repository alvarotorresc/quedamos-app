import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { usePushNotifications } from './usePushNotifications';
import { useAuthStore } from '../stores/auth';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import {
  registerForPush,
  sendTokenToBackend,
  setupPushListeners,
  setupWebForegroundHandler,
} from '../lib/push-notifications';

vi.mock('../stores/auth', () => ({
  useAuthStore: vi.fn((selector: (state: { user: { id: string } | undefined }) => unknown) =>
    selector({ user: { id: 'user-1' } }),
  ),
}));

vi.mock('../lib/push-notifications', () => ({
  registerForPush: vi.fn(),
  sendTokenToBackend: vi.fn().mockResolvedValue(undefined),
  setupPushListeners: vi.fn(),
  setupWebForegroundHandler: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn().mockReturnValue(true),
  },
}));

type AppStateChangeCallback = (state: { isActive: boolean }) => void;

function getAppStateChangeCallback(): AppStateChangeCallback {
  const call = vi
    .mocked(CapApp.addListener)
    .mock.calls.find((c) => c[0] === 'appStateChange');
  if (!call) throw new Error('appStateChange listener was not registered');
  return call[1] as AppStateChangeCallback;
}

function setVisibility(state: 'visible' | 'hidden' | 'prerender'): void {
  Object.defineProperty(document, 'visibilityState', {
    value: state,
    configurable: true,
  });
}

function fireVisibilityChange(): void {
  document.dispatchEvent(new Event('visibilitychange'));
}

async function flushMicrotasks(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('usePushNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(useAuthStore).mockImplementation((selector) => selector({ user: { id: 'user-1' } }));
    vi.mocked(sendTokenToBackend).mockResolvedValue(undefined);
    setVisibility('prerender');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setVisibility('prerender');
  });

  it('does not attach any resume listener when there is no user', () => {
    vi.mocked(useAuthStore).mockImplementation((selector) => selector({ user: undefined }));

    renderHook(() => usePushNotifications());

    expect(CapApp.addListener).not.toHaveBeenCalled();
    expect(registerForPush).not.toHaveBeenCalled();
  });

  it('sends the initial token to the backend on mount', async () => {
    vi.mocked(registerForPush).mockResolvedValue({ token: 'initial-token', cleanup: vi.fn() });

    renderHook(() => usePushNotifications());

    await waitFor(() => expect(sendTokenToBackend).toHaveBeenCalledWith('initial-token'));
    expect(setupPushListeners).toHaveBeenCalled();
    expect(setupWebForegroundHandler).toHaveBeenCalled();
  });

  describe('native resume (appStateChange)', () => {
    it('retries registration exactly once when the app resumes after a failed initial attempt', async () => {
      vi.mocked(registerForPush)
        .mockRejectedValueOnce(new Error('network error'))
        .mockResolvedValueOnce({ token: 'retry-token', cleanup: vi.fn() });

      renderHook(() => usePushNotifications());

      await waitFor(() => expect(registerForPush).toHaveBeenCalledTimes(1));
      expect(sendTokenToBackend).not.toHaveBeenCalled();

      const onAppStateChange = getAppStateChangeCallback();
      onAppStateChange({ isActive: true });

      await waitFor(() => expect(registerForPush).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(sendTokenToBackend).toHaveBeenCalledTimes(1));
      expect(sendTokenToBackend).toHaveBeenCalledWith('retry-token');
    });

    it('ignores appStateChange when isActive is false', async () => {
      vi.mocked(registerForPush).mockResolvedValue({ token: 'token', cleanup: vi.fn() });

      renderHook(() => usePushNotifications());
      await waitFor(() => expect(registerForPush).toHaveBeenCalledTimes(1));

      const onAppStateChange = getAppStateChangeCallback();
      onAppStateChange({ isActive: false });

      await flushMicrotasks();
      expect(registerForPush).toHaveBeenCalledTimes(1);
    });

    it('always resends the token on resume, even after the initial registration already succeeded', async () => {
      vi.mocked(registerForPush).mockResolvedValue({ token: 'same-token', cleanup: vi.fn() });

      renderHook(() => usePushNotifications());
      await waitFor(() => expect(sendTokenToBackend).toHaveBeenCalledTimes(1));

      const onAppStateChange = getAppStateChangeCallback();
      onAppStateChange({ isActive: true });

      await waitFor(() => expect(registerForPush).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(sendTokenToBackend).toHaveBeenCalledTimes(2));
      expect(sendTokenToBackend).toHaveBeenLastCalledWith('same-token');
    });

    it('ignores an overlapping resume while a registration is already in flight (no retry storm)', async () => {
      let resolveSecond: ((v: { token: string; cleanup: () => void }) => void) | null = null;
      vi.mocked(registerForPush)
        .mockResolvedValueOnce({ token: 'initial', cleanup: vi.fn() })
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveSecond = resolve;
            }),
        );

      renderHook(() => usePushNotifications());
      await waitFor(() => expect(registerForPush).toHaveBeenCalledTimes(1));

      const onAppStateChange = getAppStateChangeCallback();
      onAppStateChange({ isActive: true });
      await waitFor(() => expect(registerForPush).toHaveBeenCalledTimes(2));

      // Fired again while the second call is still pending — must be ignored.
      onAppStateChange({ isActive: true });
      await flushMicrotasks();
      expect(registerForPush).toHaveBeenCalledTimes(2);

      if (!resolveSecond) throw new Error('registerForPush was not called a second time');
      resolveSecond({ token: 'resumed', cleanup: vi.fn() });
      await waitFor(() => expect(sendTokenToBackend).toHaveBeenLastCalledWith('resumed'));

      // Now that the in-flight call settled, a further resume is allowed again.
      onAppStateChange({ isActive: true });
      await waitFor(() => expect(registerForPush).toHaveBeenCalledTimes(3));
    });

    it('cleans up the previous listeners before a resume re-registers (no listener leak)', async () => {
      const cleanup1 = vi.fn();
      const cleanup2 = vi.fn();
      vi.mocked(registerForPush)
        .mockResolvedValueOnce({ token: 'token-a', cleanup: cleanup1 })
        .mockResolvedValueOnce({ token: 'token-b', cleanup: cleanup2 });

      renderHook(() => usePushNotifications());
      await waitFor(() => expect(registerForPush).toHaveBeenCalledTimes(1));

      const onAppStateChange = getAppStateChangeCallback();
      onAppStateChange({ isActive: true });

      await waitFor(() => expect(registerForPush).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(cleanup1).toHaveBeenCalledTimes(1));
      expect(cleanup2).not.toHaveBeenCalled();
    });

    it('removes the appStateChange listener on unmount', async () => {
      const removeHandle = vi.fn();
      vi.mocked(CapApp.addListener).mockResolvedValue({ remove: removeHandle });
      vi.mocked(registerForPush).mockResolvedValue({ token: 'token', cleanup: vi.fn() });

      const { unmount } = renderHook(() => usePushNotifications());
      await waitFor(() =>
        expect(CapApp.addListener).toHaveBeenCalledWith('appStateChange', expect.any(Function)),
      );

      unmount();

      await waitFor(() => expect(removeHandle).toHaveBeenCalled());
    });
  });

  describe('web resume (visibilitychange)', () => {
    beforeEach(() => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    });

    it('does not retry on visibilitychange when notification permission is not granted', async () => {
      vi.mocked(registerForPush).mockResolvedValue({ token: 'token-a', cleanup: vi.fn() });
      vi.stubGlobal('Notification', { permission: 'default' });

      renderHook(() => usePushNotifications());
      await waitFor(() => expect(registerForPush).toHaveBeenCalledTimes(1));

      setVisibility('visible');
      fireVisibilityChange();

      await flushMicrotasks();
      expect(registerForPush).toHaveBeenCalledTimes(1);
    });

    it('ignores visibilitychange when the document is hidden', async () => {
      vi.mocked(registerForPush).mockResolvedValue({ token: 'token-a', cleanup: vi.fn() });
      vi.stubGlobal('Notification', { permission: 'granted' });

      renderHook(() => usePushNotifications());
      await waitFor(() => expect(registerForPush).toHaveBeenCalledTimes(1));

      setVisibility('hidden');
      fireVisibilityChange();

      await flushMicrotasks();
      expect(registerForPush).toHaveBeenCalledTimes(1);
    });

    it('re-invokes registerForPush on resume but only resends when the token changed', async () => {
      vi.stubGlobal('Notification', { permission: 'granted' });
      vi.mocked(registerForPush)
        .mockResolvedValueOnce({ token: 'token-a', cleanup: vi.fn() })
        .mockResolvedValueOnce({ token: 'token-a', cleanup: vi.fn() })
        .mockResolvedValueOnce({ token: 'token-b', cleanup: vi.fn() });

      renderHook(() => usePushNotifications());
      await waitFor(() => expect(sendTokenToBackend).toHaveBeenCalledTimes(1));

      setVisibility('visible');
      fireVisibilityChange();

      await waitFor(() => expect(registerForPush).toHaveBeenCalledTimes(2));
      await flushMicrotasks();
      expect(sendTokenToBackend).toHaveBeenCalledTimes(1); // unchanged token, not resent

      fireVisibilityChange();

      await waitFor(() => expect(registerForPush).toHaveBeenCalledTimes(3));
      await waitFor(() => expect(sendTokenToBackend).toHaveBeenCalledTimes(2));
      expect(sendTokenToBackend).toHaveBeenLastCalledWith('token-b');
    });

    it('retries sending the same token again after a previous send failed', async () => {
      vi.stubGlobal('Notification', { permission: 'granted' });
      vi.mocked(registerForPush).mockResolvedValue({ token: 'token-a', cleanup: vi.fn() });
      vi.mocked(sendTokenToBackend).mockRejectedValueOnce(new Error('network error'));

      renderHook(() => usePushNotifications());
      await waitFor(() => expect(sendTokenToBackend).toHaveBeenCalledTimes(1));

      setVisibility('visible');
      fireVisibilityChange();

      await waitFor(() => expect(registerForPush).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(sendTokenToBackend).toHaveBeenCalledTimes(2));
      expect(sendTokenToBackend).toHaveBeenLastCalledWith('token-a');
    });

    it('removes the visibilitychange listener on unmount', async () => {
      vi.stubGlobal('Notification', { permission: 'granted' });
      vi.mocked(registerForPush).mockResolvedValue({ token: 'token-a', cleanup: vi.fn() });
      const removeSpy = vi.spyOn(document, 'removeEventListener');

      const { unmount } = renderHook(() => usePushNotifications());
      await waitFor(() => expect(registerForPush).toHaveBeenCalledTimes(1));

      unmount();

      expect(removeSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    });
  });

  describe('effect deps keyed on user id (not the User object)', () => {
    it('does not re-register when the user object changes but the id stays the same', async () => {
      vi.mocked(registerForPush).mockResolvedValue({ token: 'token-x', cleanup: vi.fn() });
      vi.mocked(useAuthStore).mockImplementation((selector) => selector({ user: { id: 'user-1' } }));

      const { rerender } = renderHook(() => usePushNotifications());
      await waitFor(() => expect(registerForPush).toHaveBeenCalledTimes(1));

      // Simulate a profile edit (e.g. updateName/updateTimeSlots): same id, a new
      // object reference for `user`.
      vi.mocked(useAuthStore).mockImplementation((selector) => selector({ user: { id: 'user-1' } }));
      rerender();

      await flushMicrotasks();
      expect(registerForPush).toHaveBeenCalledTimes(1);
    });

    it('re-registers when the user id actually changes', async () => {
      vi.mocked(registerForPush).mockResolvedValue({ token: 'token-x', cleanup: vi.fn() });
      vi.mocked(useAuthStore).mockImplementation((selector) => selector({ user: { id: 'user-1' } }));

      const { rerender } = renderHook(() => usePushNotifications());
      await waitFor(() => expect(registerForPush).toHaveBeenCalledTimes(1));

      vi.mocked(useAuthStore).mockImplementation((selector) => selector({ user: { id: 'user-2' } }));
      rerender();

      await waitFor(() => expect(registerForPush).toHaveBeenCalledTimes(2));
    });
  });

  describe('resets the last-sent-token memory on logout (web)', () => {
    beforeEach(() => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    });

    it('resends a token that looks unchanged to the backend for the next signed-in user after a logout', async () => {
      vi.stubGlobal('Notification', { permission: 'granted' });
      vi.mocked(registerForPush).mockResolvedValue({ token: 'shared-device-token', cleanup: vi.fn() });
      vi.mocked(useAuthStore).mockImplementation((selector) => selector({ user: { id: 'user-1' } }));

      const { rerender } = renderHook(() => usePushNotifications());
      await waitFor(() => expect(sendTokenToBackend).toHaveBeenCalledTimes(1));

      // Logout: the effect cleans up and, per the fix, clears lastSentTokenRef so it
      // doesn't leak into the next signed-in user's session.
      vi.mocked(useAuthStore).mockImplementation((selector) => selector({ user: undefined }));
      rerender();
      await flushMicrotasks();

      // A different user signs in on the same browser/device. FCM tokens are
      // per-installation, not per-user, so it's plausible the resolved token is the
      // literal same string as before.
      vi.mocked(useAuthStore).mockImplementation((selector) => selector({ user: { id: 'user-2' } }));
      rerender();

      await waitFor(() => expect(sendTokenToBackend).toHaveBeenCalledTimes(2));
      expect(sendTokenToBackend).toHaveBeenLastCalledWith('shared-device-token');
    });
  });
});
