import {
  IonPage,
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import {
  useNotificationPreferences,
  useUpdateNotificationPreference,
} from '../hooks/useNotificationPreferences';
import type { NotificationType } from '../services/notification-preferences';
import { useScreenView } from '../hooks/useAnalytics';

interface NotifSection {
  headerKey: string;
  types: { type: NotificationType; labelKey: string }[];
}

const NOTIF_SECTIONS: NotifSection[] = [
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

export default function NotificationsSettingsPage() {
  useScreenView('NotificationSettings');
  const { t } = useTranslation();
  const { data: notifPrefs } = useNotificationPreferences();
  const updatePref = useUpdateNotificationPreference();

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar className="py-2">
          <IonButtons slot="start">
            <IonBackButton defaultHref="/tabs/profile" text="" />
          </IonButtons>
          <IonTitle>{t('profile.notifications.title')}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <div className="max-w-md mx-auto px-4 pt-2">
          {NOTIF_SECTIONS.map((section) => (
            <div key={section.headerKey} className="mb-5">
              <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2 px-1">
                {t(section.headerKey)}
              </h3>
              <div className="flex flex-col gap-2">
                {section.types.map(({ type, labelKey }) => {
                  const pref = notifPrefs?.find((p) => p.type === type);
                  const enabled = pref?.enabled ?? true;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => updatePref.mutate({ type, enabled: !enabled })}
                      className="w-full bg-bg-card border border-subtle rounded-btn px-4 py-3.5 flex items-center justify-between"
                    >
                      <span className="text-sm text-text">{t(labelKey)}</span>
                      <div
                        className={`w-10 h-6 rounded-full relative transition-colors ${enabled ? 'bg-primary/30' : 'bg-toggle-off'}`}
                      >
                        <div
                          className={`absolute top-0.5 w-5 h-5 rounded-full transition-all ${enabled ? 'right-0.5 bg-primary' : 'left-0.5 bg-text-dark'}`}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </IonContent>
    </IonPage>
  );
}
