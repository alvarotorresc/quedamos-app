import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { groupsService } from '../services/groups';
import { broadcastSync } from '../lib/group-sync';

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
