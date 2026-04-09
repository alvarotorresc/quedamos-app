import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMyColor } from './useMyColor';
import { createWrapper } from '../test/test-utils';
import { getMemberColorByUserId, MEMBER_COLORS } from '../lib/constants';
import type { useAuthStore } from '../stores/auth';

type AuthStoreState = ReturnType<typeof useAuthStore.getState>;

vi.mock('../stores/auth', () => ({
  useAuthStore: vi.fn((selector) => selector({ user: { id: 'user-1' } })),
}));

describe('useMyColor', () => {
  it('should return hash-based color for the authenticated user', () => {
    const { result } = renderHook(() => useMyColor(), { wrapper: createWrapper() });
    expect(result.current).toBe(getMemberColorByUserId('user-1'));
  });

  it('should return default color when no user', async () => {
    const { useAuthStore } = await import('../stores/auth');
    vi.mocked(useAuthStore).mockImplementation((selector) =>
      selector({ user: null } as unknown as AuthStoreState),
    );

    const { result } = renderHook(() => useMyColor(), { wrapper: createWrapper() });
    expect(result.current).toBe(MEMBER_COLORS[0]);
  });

  it('should return stable color regardless of group membership', async () => {
    const { useAuthStore } = await import('../stores/auth');
    vi.mocked(useAuthStore).mockImplementation((selector) =>
      selector({ user: { id: 'user-7' } } as unknown as AuthStoreState),
    );

    const { result } = renderHook(() => useMyColor(), { wrapper: createWrapper() });
    expect(result.current).toBe(getMemberColorByUserId('user-7'));
  });
});
