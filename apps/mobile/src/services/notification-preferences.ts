import { api } from '../lib/api';

export const NOTIFICATION_TYPES = [
  'new_event',
  'event_updated',
  'event_deleted',
  'event_cancelled',
  'event_confirmed',
  'event_declined',
  'event_reminder',
  'new_proposal',
  'proposal_voted',
  'proposal_converted',
  'new_poll',
  'poll_completed',
  'member_joined',
  'member_left',
  'role_changed',
  'member_kicked',
  'group_deleted',
  'weekly_availability_reminder',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface NotifSection {
  headerKey: string;
  types: { type: NotificationType; labelKey: string }[];
}

/**
 * Catálogo de la pantalla de ajustes. Vive junto al union para que el test
 * pueda exigir una fila por tipo: un tipo nuevo sin ajuste no se cuela.
 */
export const NOTIF_SECTIONS: NotifSection[] = [
  {
    headerKey: 'profile.notifications.groups.events',
    types: [
      { type: 'new_event', labelKey: 'profile.notifications.newEvent' },
      { type: 'event_updated', labelKey: 'profile.notifications.eventUpdated' },
      { type: 'event_deleted', labelKey: 'profile.notifications.eventDeleted' },
      { type: 'event_cancelled', labelKey: 'profile.notifications.eventCancelled' },
      { type: 'event_confirmed', labelKey: 'profile.notifications.eventConfirmed' },
      { type: 'event_declined', labelKey: 'profile.notifications.eventDeclined' },
      { type: 'event_reminder', labelKey: 'profile.notifications.eventReminder' },
    ],
  },
  {
    headerKey: 'profile.notifications.groups.questions',
    types: [
      { type: 'new_poll', labelKey: 'profile.notifications.newPoll' },
      { type: 'poll_completed', labelKey: 'profile.notifications.pollCompleted' },
    ],
  },
  {
    headerKey: 'profile.notifications.groups.proposals',
    types: [
      { type: 'new_proposal', labelKey: 'profile.notifications.newProposal' },
      { type: 'proposal_voted', labelKey: 'profile.notifications.proposalVoted' },
      { type: 'proposal_converted', labelKey: 'profile.notifications.proposalConverted' },
    ],
  },
  {
    headerKey: 'profile.notifications.groups.members',
    types: [
      { type: 'member_joined', labelKey: 'profile.notifications.memberJoined' },
      { type: 'member_left', labelKey: 'profile.notifications.memberLeft' },
      { type: 'role_changed', labelKey: 'profile.notifications.roleChanged' },
      { type: 'member_kicked', labelKey: 'profile.notifications.memberKicked' },
      { type: 'group_deleted', labelKey: 'profile.notifications.groupDeleted' },
    ],
  },
  {
    headerKey: 'profile.notifications.groups.reminders',
    types: [
      { type: 'weekly_availability_reminder', labelKey: 'profile.notifications.weeklyReminder' },
    ],
  },
];

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
