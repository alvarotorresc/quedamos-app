import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import {
  useGroups,
  useGroup,
  useCreateGroup,
  useJoinGroup,
  useLeaveGroup,
  useGroupInvite,
  useRefreshInvite,
  useUpdateMemberRole,
  useKickMember,
  useDeleteGroup,
} from './useGroups';
import { groupsService, type GroupWithMembers } from '../services/groups';
import { createWrapper } from '../test/test-utils';

vi.mock('../services/groups', () => ({
  groupsService: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    join: vi.fn(),
    leave: vi.fn(),
    getInvite: vi.fn(),
    refreshInvite: vi.fn(),
    updateMemberRole: vi.fn(),
    kickMember: vi.fn(),
    deleteGroup: vi.fn(),
  },
}));

vi.mock('../lib/group-sync', () => ({
  broadcastSync: vi.fn(),
}));

describe('useGroups', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch groups', async () => {
    const groups = [{ id: 'g1', name: 'Test' }] as unknown as GroupWithMembers[];
    vi.mocked(groupsService.getAll).mockResolvedValue(groups);

    const { result } = renderHook(() => useGroups(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(groups);
  });

  it('should handle error', async () => {
    vi.mocked(groupsService.getAll).mockRejectedValue(new Error('Failed'));

    const { result } = renderHook(() => useGroups(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useGroup', () => {
  it('should fetch single group', async () => {
    const group = { id: 'g1', name: 'Test', members: [] } as unknown as GroupWithMembers;
    vi.mocked(groupsService.getById).mockResolvedValue(group);

    const { result } = renderHook(() => useGroup('g1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(group);
  });

  it('should not fetch when id is empty', () => {
    const { result } = renderHook(() => useGroup(''), { wrapper: createWrapper() });
    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useCreateGroup', () => {
  it('should create group', async () => {
    const group = { id: 'g1', name: 'New' } as unknown as GroupWithMembers;
    vi.mocked(groupsService.create).mockResolvedValue(group);

    const { result } = renderHook(() => useCreateGroup(), { wrapper: createWrapper() });

    result.current.mutate({ name: 'New', emoji: '🎉' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(groupsService.create).toHaveBeenCalledWith(
      { name: 'New', emoji: '🎉' },
      expect.anything(),
    );
  });
});

describe('useJoinGroup', () => {
  it('should join group by code', async () => {
    const group = { id: 'g1', name: 'Joined' } as unknown as GroupWithMembers;
    vi.mocked(groupsService.join).mockResolvedValue(group);

    const { result } = renderHook(() => useJoinGroup(), { wrapper: createWrapper() });

    result.current.mutate('12345678');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(groupsService.join).toHaveBeenCalledWith('12345678', expect.anything());
  });
});

describe('useLeaveGroup', () => {
  it('should leave group', async () => {
    vi.mocked(groupsService.leave).mockResolvedValue({ success: true });

    const { result } = renderHook(() => useLeaveGroup(), { wrapper: createWrapper() });

    result.current.mutate('g1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(groupsService.leave).toHaveBeenCalledWith('g1', expect.anything());
  });
});

describe('useGroupInvite', () => {
  it('should fetch invite info', async () => {
    const invite = { inviteCode: '12345678', inviteUrl: 'https://...' };
    vi.mocked(groupsService.getInvite).mockResolvedValue(invite);

    const { result } = renderHook(() => useGroupInvite('g1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(invite);
  });
});

describe('useRefreshInvite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should refresh invite code', async () => {
    const newInvite = { inviteCode: 'NEW12345', inviteUrl: 'https://.../join/NEW12345' };
    vi.mocked(groupsService.refreshInvite).mockResolvedValue(newInvite);

    const { result } = renderHook(() => useRefreshInvite(), { wrapper: createWrapper() });

    result.current.mutate('g1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(groupsService.refreshInvite).toHaveBeenCalledWith('g1', expect.anything());
  });
});

describe('useUpdateMemberRole', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should promote member to admin', async () => {
    vi.mocked(groupsService.updateMemberRole).mockResolvedValue({ role: 'admin' });

    const { result } = renderHook(() => useUpdateMemberRole('g1'), { wrapper: createWrapper() });

    result.current.mutate({ userId: 'user-2', role: 'admin' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(groupsService.updateMemberRole).toHaveBeenCalledWith('g1', 'user-2', 'admin');
  });

  it('should demote admin to member', async () => {
    vi.mocked(groupsService.updateMemberRole).mockResolvedValue({ role: 'member' });

    const { result } = renderHook(() => useUpdateMemberRole('g1'), { wrapper: createWrapper() });

    result.current.mutate({ userId: 'user-2', role: 'member' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(groupsService.updateMemberRole).toHaveBeenCalledWith('g1', 'user-2', 'member');
  });
});

describe('useKickMember', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should kick member from group', async () => {
    vi.mocked(groupsService.kickMember).mockResolvedValue({ success: true });

    const { result } = renderHook(() => useKickMember('g1'), { wrapper: createWrapper() });

    result.current.mutate('user-2');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(groupsService.kickMember).toHaveBeenCalledWith('g1', 'user-2');
  });
});

describe('useDeleteGroup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should delete group', async () => {
    vi.mocked(groupsService.deleteGroup).mockResolvedValue({ success: true });

    const { result } = renderHook(() => useDeleteGroup(), { wrapper: createWrapper() });

    result.current.mutate('g1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(groupsService.deleteGroup).toHaveBeenCalledWith('g1', expect.anything());
  });
});
