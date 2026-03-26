import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { groupsService } from '../services/groups';
import { broadcastSync } from '../lib/group-sync';
import { logEvent } from '../lib/firebase';

export function useGroups() {
  return useQuery({
    queryKey: ['groups'],
    queryFn: groupsService.getAll,
  });
}

export function useGroup(id: string) {
  return useQuery({
    queryKey: ['groups', id],
    queryFn: () => groupsService.getById(id),
    enabled: !!id,
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: groupsService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
  });
}

export function useJoinGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: groupsService.join,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      broadcastSync(data.id, 'groups');
      logEvent('join_group', { method: 'code' }).catch(() => {});
    },
  });
}

export function useLeaveGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: groupsService.leave,
    onSuccess: (_data, groupId) => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      broadcastSync(groupId, 'groups');
    },
  });
}

export function useGroupInvite(groupId: string) {
  return useQuery({
    queryKey: ['groups', groupId, 'invite'],
    queryFn: () => groupsService.getInvite(groupId),
    enabled: !!groupId,
  });
}

export function useRefreshInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: groupsService.refreshInvite,
    onSuccess: (_data, groupId) => {
      queryClient.invalidateQueries({ queryKey: ['groups', groupId, 'invite'] });
    },
  });
}

export function useUpdateMemberRole(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: 'admin' | 'member' }) =>
      groupsService.updateMemberRole(groupId, userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups', groupId] });
      broadcastSync(groupId, 'groups');
    },
  });
}

export function useKickMember(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => groupsService.kickMember(groupId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups', groupId] });
      broadcastSync(groupId, 'groups');
    },
  });
}

export function useDeleteGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: groupsService.deleteGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
  });
}
