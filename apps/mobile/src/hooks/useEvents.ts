import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { eventsService, CreateEventDto, Event } from '../services/events';
import { broadcastSync } from '../lib/group-sync';
import { useAuthStore } from '../stores/auth';

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
  const userId = useAuthStore((s) => s.user?.id);

  return useMutation({
    mutationFn: ({ eventId, status }: { eventId: string; status: 'confirmed' | 'declined' }) =>
      eventsService.respond(groupId, eventId, status),
    onMutate: async ({ eventId, status }) => {
      await queryClient.cancelQueries({ queryKey: ['events', groupId] });
      const previous = queryClient.getQueryData<Event[]>(['events', groupId]);

      if (previous && userId) {
        queryClient.setQueryData<Event[]>(['events', groupId], (old) =>
          old?.map((ev) =>
            ev.id === eventId
              ? {
                  ...ev,
                  attendees: ev.attendees.map((a) =>
                    a.userId === userId
                      ? { ...a, status, respondedAt: new Date().toISOString() }
                      : a,
                  ),
                }
              : ev,
          ),
        );
      }

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['events', groupId], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['events', groupId] });
      broadcastSync(groupId, 'events');
    },
  });
}
