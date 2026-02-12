import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { eventsService, CreateEventDto } from '../services/events';
import { broadcastSync } from '../lib/group-sync';

export function useEvents(groupId: string) {
  return useQuery({
    queryKey: ['events', groupId],
    queryFn: () => eventsService.getAll(groupId),
    enabled: !!groupId,
  });
}

export function useEvent(groupId: string, eventId: string) {
  return useQuery({
    queryKey: ['events', groupId, eventId],
    queryFn: () => eventsService.getById(groupId, eventId),
    enabled: !!groupId && !!eventId,
  });
}

export function useCreateEvent(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateEventDto) => eventsService.create(groupId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', groupId] });
      broadcastSync(groupId, 'events');
    },
  });
}

export function useRespondEvent(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ eventId, status }: { eventId: string; status: 'confirmed' | 'declined' }) =>
      eventsService.respond(groupId, eventId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', groupId] });
      broadcastSync(groupId, 'events');
    },
  });
}
