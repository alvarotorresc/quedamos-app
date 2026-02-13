import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useGroups, useGroup, useCreateGroup, useJoinGroup, useLeaveGroup, useGroupInvite } from './useGroups';
import { groupsService } from '../services/groups';
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
    const groups = [{ id: 'g1', name: 'Test' }];
    vi.mocked(groupsService.getAll).mockResolvedValue(groups as any);

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
    const group = { id: 'g1', name: 'Test', members: [] };
    vi.mocked(groupsService.getById).mockResolvedValue(group as any);

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
    const group = { id: 'g1', name: 'New' };
    vi.mocked(groupsService.create).mockResolvedValue(group as any);

    const { result } = renderHook(() => useCreateGroup(), { wrapper: createWrapper() });

    result.current.mutate({ name: 'New', emoji: '🎉' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(groupsService.create).toHaveBeenCalledWith({ name: 'New', emoji: '🎉' }, expect.anything());
  });
});

describe('useJoinGroup', () => {
  it('should join group by code', async () => {
    const group = { id: 'g1', name: 'Joined' };
    vi.mocked(groupsService.join).mockResolvedValue(group as any);

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
