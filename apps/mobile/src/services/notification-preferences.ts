import { api } from '../lib/api';

export type NotificationType =
  | 'new_event'
  | 'event_updated'
  | 'event_deleted'
  | 'event_cancelled'
  | 'event_confirmed'
  | 'event_declined'
  | 'event_reminder'
  | 'new_proposal'
  | 'proposal_voted'
  | 'proposal_converted'
  | 'member_joined'
  | 'member_left'
  | 'role_changed'
  | 'member_kicked'
  | 'group_deleted'
  | 'weekly_availability_reminder';

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
