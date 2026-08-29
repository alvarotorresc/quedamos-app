import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pollsService, type CreatePollDto, type Poll } from '../services/polls';
import type { Event } from '../services/events';
import { useEvents } from './useEvents';
import { broadcastSync } from '../lib/group-sync';
import { useAuthStore } from '../stores/auth';
import { logEvent } from '../lib/firebase';
import { apiDateToKey, formatDateKey } from '../lib/date-utils';

export function usePolls(groupId: string) {
  return useQuery({
    queryKey: ['polls', groupId],
    queryFn: () => pollsService.list(groupId),
    enabled: !!groupId,
  });
}

export function useCreatePoll(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreatePollDto) => pollsService.create(groupId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['polls', groupId] });
      queryClient.invalidateQueries({ queryKey: ['availability', groupId] });
      broadcastSync(groupId, 'polls');
      logEvent('create_poll').catch(() => {});
    },
  });
}

export function useRespondPoll(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ pollId, answer }: { pollId: string; answer: 'yes' | 'no' | 'unsure' }) =>
      pollsService.respond(groupId, pollId, answer),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['polls', groupId] });
      queryClient.invalidateQueries({ queryKey: ['availability', groupId] });
      broadcastSync(groupId, 'polls');
      logEvent('respond_poll').catch(() => {});
    },
  });
}

export function usePendingQuestions(groupId: string): { polls: Poll[]; pendingEvents: Event[] } {
  const userId = useAuthStore((s) => s.user?.id);
  const { data: polls } = usePolls(groupId);
  const { data: events } = useEvents(groupId);

  return useMemo(() => {
    if (!userId) {
      return { polls: [], pendingEvents: [] };
    }

    const today = formatDateKey(new Date());

    const pendingPolls = (polls ?? []).filter(
      (p) =>
        p.status === 'open' &&
        apiDateToKey(p.date) >= today &&
        !p.responses.some((r) => r.userId === userId),
    );

    const pendingEvents = (events ?? []).filter((ev) => {
      if (ev.status === 'cancelled') return false;
      if (apiDateToKey(ev.date) < today) return false;
      return ev.attendees.some((a) => a.userId === userId && a.status === 'pending');
    });

    return { polls: pendingPolls, pendingEvents };
  }, [polls, events, userId]);
}
