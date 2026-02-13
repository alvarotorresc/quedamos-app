import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMyColor } from './useMyColor';
import { createWrapper } from '../test/test-utils';

vi.mock('../stores/auth', () => ({
  useAuthStore: vi.fn((selector) => selector({ user: { id: 'user-1' } })),
}));

vi.mock('../stores/group', () => ({
  useGroupStore: vi.fn((selector) => selector({ currentGroup: { id: 'g1' } })),
}));

vi.mock('./useGroups', () => ({
  useGroup: vi.fn().mockReturnValue({
    data: {
      members: [
        { userId: 'user-1' },
        { userId: 'user-2' },
        { userId: 'user-3' },
      ],
    },
  }),
}));

describe('useMyColor', () => {
  it('should return color for user index', () => {
    const { result } = renderHook(() => useMyColor(), { wrapper: createWrapper() });
    expect(result.current).toBe('#60A5FA'); // First member = blue
  });

  it('should return default color when no user', async () => {
    const { useAuthStore } = await import('../stores/auth');
    vi.mocked(useAuthStore).mockImplementation((selector) =>
      selector({ user: null } as any),
    );

    const { result } = renderHook(() => useMyColor(), { wrapper: createWrapper() });
    expect(result.current).toBe('#60A5FA'); // Default
  });

  it('should wrap colors for large groups', async () => {
    const { useGroup } = await import('./useGroups');
    vi.mocked(useGroup).mockReturnValue({
      data: {
        members: Array.from({ length: 8 }, (_, i) => ({ userId: `user-${i}` })),
      },
    } as any);
    const { useAuthStore } = await import('../stores/auth');
    vi.mocked(useAuthStore).mockImplementation((selector) =>
      selector({ user: { id: 'user-7' } } as any),
    );

    const { result } = renderHook(() => useMyColor(), { wrapper: createWrapper() });
    // user-7 is index 7, 7 % 6 = 1, which is '#F59E0B'
    expect(result.current).toBe('#F59E0B');
  });
});
