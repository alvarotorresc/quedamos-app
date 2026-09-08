import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSessionExpiry } from './useSessionExpiry';
import { setSessionExpiredHandler } from '../lib/api';

vi.mock('../lib/api', () => ({
  setSessionExpiredHandler: vi.fn(),
}));

const showError = vi.fn();
vi.mock('./useToast', () => ({
  useToast: () => ({ showError, showSuccess: vi.fn(), showInfo: vi.fn() }),
}));

const signOut = vi.fn().mockResolvedValue(undefined);
vi.mock('../stores/auth', () => ({
  useAuthStore: (selector: (s: { signOut: () => Promise<void> }) => unknown) =>
    selector({ signOut }),
}));

/** The callback the hook handed to the api layer. */
function registeredHandler(): () => void {
  const call = vi
    .mocked(setSessionExpiredHandler)
    .mock.calls.find(([handler]) => typeof handler === 'function');
  if (!call) throw new Error('no session-expired handler was registered');
  return call[0] as () => void;
}

describe('useSessionExpiry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signOut.mockResolvedValue(undefined);
  });

  it('registers a handler that warns and signs out', async () => {
    renderHook(() => useSessionExpiry());

    registeredHandler()();

    expect(showError).toHaveBeenCalledWith('errors.sessionExpired');
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('swallows a failing sign-out so the toast is still the only thing the user sees', async () => {
    signOut.mockRejectedValue(new Error('network down'));
    renderHook(() => useSessionExpiry());

    expect(() => registeredHandler()()).not.toThrow();
    await Promise.resolve();

    expect(showError).toHaveBeenCalledWith('errors.sessionExpired');
  });

  it('unregisters the handler when it unmounts', () => {
    const { unmount } = renderHook(() => useSessionExpiry());

    unmount();

    expect(setSessionExpiredHandler).toHaveBeenLastCalledWith(null);
  });
});
