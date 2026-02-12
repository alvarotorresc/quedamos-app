import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { availabilityService, CreateAvailabilityDto } from '../services/availability';
import { broadcastSync } from '../lib/group-sync';

export function useAvailability(groupId: string) {
  return useQuery({
    queryKey: ['availability', groupId],
    queryFn: () => availabilityService.getAll(groupId),
    enabled: !!groupId,
  });
}

export function useMyAvailability(groupId: string) {
  return useQuery({
    queryKey: ['availability', groupId, 'me'],
    queryFn: () => availabilityService.getMine(groupId),
    enabled: !!groupId,
  });
}

export function useCreateAvailability(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateAvailabilityDto) =>
      availabilityService.create(groupId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability', groupId] });
      broadcastSync(groupId, 'availability');
    },
  });
}

export function useDeleteAvailability(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (date: string) => availabilityService.delete(groupId, date),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability', groupId] });
      broadcastSync(groupId, 'availability');
    },
  });
}
