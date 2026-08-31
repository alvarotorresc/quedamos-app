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
import { NOTIF_SECTIONS } from '../services/notification-preferences';
import { useScreenView } from '../hooks/useAnalytics';

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
                        className={`w-10 h-6 rounded-full relative transition-colors ${enabled ? 'bg-primary-tint' : 'bg-toggle-off'}`}
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
