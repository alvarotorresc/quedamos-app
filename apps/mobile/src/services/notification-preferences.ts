import { api } from '../lib/api';

export type NotificationType =
  | 'new_event'
  | 'event_confirmed'
  | 'event_declined'
  | 'member_joined'
  | 'member_left';

export interface NotificationPreference {
  type: NotificationType;
  enabled: boolean;
}

export const notificationPreferencesService = {
  getAll: () =>
    api.get<NotificationPreference[]>('/notifications/preferences'),

  update: (type: NotificationType, enabled: boolean) =>
    api.put<NotificationPreference>('/notifications/preferences', { type, enabled }),
};
