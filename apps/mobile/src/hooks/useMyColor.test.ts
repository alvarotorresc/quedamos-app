import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMyColor } from './useMyColor';
import { createWrapper } from '../test/test-utils';
import { useGroupStore } from '../stores/group';
import { getMemberColorByUserId, MEMBER_COLORS } from '../lib/constants';
import type { useAuthStore } from '../stores/auth';
import type { useGroup as UseGroup, useGroups as UseGroups } from './useGroups';

type AuthStoreState = ReturnType<typeof useAuthStore.getState>;

// Members ordered by joinedAt so user-7 (earlier) gets index 0 and user-1 (later) index 1.
// user-1's hash color (getMemberColorByUserId) differs from its positional color
// (MEMBER_COLORS[1]) — this is what makes it a useful discriminating case below.
const members = [
  {
    userId: 'user-1',
    joinedAt: '2026-01-02T00:00:00Z',
    role: 'member',
    user: { id: 'user-1', name: 'Uno', avatarEmoji: '😊' },
  },
  {
    userId: 'user-7',
    joinedAt: '2026-01-01T00:00:00Z',
    role: 'admin',
    user: { id: 'user-7', name: 'Siete', avatarEmoji: '😊' },
  },
];

const group1 = {
  id: 'group-1',
  name: 'Grupo',
  emoji: '👥',
  createdById: 'user-7',
  createdAt: '2026-01-01T00:00:00Z',
  members,
};

vi.mock('../stores/auth', () => ({
  useAuthStore: vi.fn((selector) => selector({ user: { id: 'user-1' } })),
}));

vi.mock('./useGroups', () => ({
  useGroup: vi.fn(() => ({ data: group1 })),
  useGroups: vi.fn(() => ({ data: [group1] })),
}));

describe('useMyColor', () => {
  beforeEach(() => {
    useGroupStore.setState({ currentGroup: { id: 'group-1', name: 'Grupo', emoji: '👥' } });
  });

  it('should return color by position (join order) within the active group', () => {
    const { result } = renderHook(() => useMyColor(), { wrapper: createWrapper() });
    // user-7 joined first -> index 0, user-1 joined second -> index 1
    expect(result.current).toBe(MEMBER_COLORS[1]);
  });

  it('should return default color when no user', async () => {
    const { useAuthStore } = await import('../stores/auth');
    vi.mocked(useAuthStore).mockImplementation((selector) =>
      selector({ user: null } as unknown as AuthStoreState),
    );

    const { result } = renderHook(() => useMyColor(), { wrapper: createWrapper() });
    expect(result.current).toBe(MEMBER_COLORS[0]);
  });

  it('should fall back to hash-based color when there is no active group / member data', async () => {
    const { useAuthStore } = await import('../stores/auth');
    vi.mocked(useAuthStore).mockImplementation((selector) =>
      selector({ user: { id: 'user-1' } } as unknown as AuthStoreState),
    );
    const { useGroup } = await import('./useGroups');
    vi.mocked(useGroup).mockReturnValue({ data: undefined } as unknown as ReturnType<typeof UseGroup>);
    useGroupStore.setState({ currentGroup: null });

    const { result } = renderHook(() => useMyColor(), { wrapper: createWrapper() });
    expect(result.current).toBe(getMemberColorByUserId('user-1'));
  });

  it('should fall back to the first group from useGroups() when there is no active group yet (e.g. fresh session on GroupPage, deep link)', async () => {
    const { useAuthStore } = await import('../stores/auth');
    vi.mocked(useAuthStore).mockImplementation((selector) =>
      selector({ user: { id: 'user-1' } } as unknown as AuthStoreState),
    );
    const { useGroup, useGroups } = await import('./useGroups');
    vi.mocked(useGroups).mockReturnValue({ data: [group1] } as unknown as ReturnType<typeof UseGroups>);
    vi.mocked(useGroup).mockReturnValue({ data: group1 } as unknown as ReturnType<typeof UseGroup>);
    useGroupStore.setState({ currentGroup: null });

    const { result } = renderHook(() => useMyColor(), { wrapper: createWrapper() });
    // Position-based color from group1's member list, NOT the global hash color.
    expect(result.current).toBe(MEMBER_COLORS[1]);
    expect(result.current).not.toBe(getMemberColorByUserId('user-1'));
  });
});
