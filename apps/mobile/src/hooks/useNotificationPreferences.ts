import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  notificationPreferencesService,
  NotificationType,
  NotificationPreference,
} from '../services/notification-preferences';

export function useNotificationPreferences() {
  return useQuery({
    queryKey: ['notification-preferences'],
    queryFn: () => notificationPreferencesService.getAll(),
  });
}

export function useUpdateNotificationPreference() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ type, enabled }: { type: NotificationType; enabled: boolean }) =>
      notificationPreferencesService.update(type, enabled),
    onMutate: async ({ type, enabled }) => {
      await queryClient.cancelQueries({ queryKey: ['notification-preferences'] });
      const prev = queryClient.getQueryData<NotificationPreference[]>(['notification-preferences']);
      if (prev) {
        queryClient.setQueryData<NotificationPreference[]>(
          ['notification-preferences'],
          prev.map((p) => (p.type === type ? { ...p, enabled } : p)),
        );
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(['notification-preferences'], ctx.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
    },
  });
}
