import { IonPage, IonContent, IonHeader, IonToolbar, IonButtons, IonBackButton } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import {
  useNotificationPreferences,
  useUpdateNotificationPreference,
} from '../hooks/useNotificationPreferences';
import { NOTIF_SECTIONS } from '../services/notification-preferences';
import { useScreenView } from '../hooks/useAnalytics';
import { useMyColor } from '../hooks/useMyColor';
import { useToast } from '../hooks/useToast';
import { Toggle } from '../ui/Toggle';

export default function NotificationsSettingsPage() {
  useScreenView('NotificationSettings');
  const { t } = useTranslation();
  const { data: notifPrefs } = useNotificationPreferences();
  const updatePref = useUpdateNotificationPreference();
  const myColor = useMyColor();
  const { showError } = useToast();

  const isEnabled = (type: string): boolean =>
    notifPrefs?.find((p) => p.type === type)?.enabled ?? true;
  const allTypes = NOTIF_SECTIONS.flatMap((section) => section.types);
  const enabledCount = allTypes.filter(({ type }) => isEnabled(type)).length;

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar className="py-2">
          <IonButtons slot="start">
            <IonBackButton defaultHref="/tabs/profile" text="" />
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <div className="max-w-md mx-auto px-4 pt-2 pb-6">
          <div className="mb-3">
            <h1 className="text-[27px] font-extrabold tracking-tight text-text">
              {t('profile.notifications.title')}
            </h1>
            <p className="font-mono text-[10px] tracking-[0.16em] uppercase text-text-muted">
              {t('profile.notifications.subtitle', { enabled: enabledCount, total: allTypes.length })}
            </p>
          </div>

          {NOTIF_SECTIONS.map((section) => (
            <section key={section.headerKey}>
              <h3 className="font-mono text-[10px] tracking-[0.14em] uppercase text-text-muted mt-4 mb-2 ml-1">
                {t(section.headerKey)}
              </h3>
              <div className="bg-bg-light border border-subtle rounded-lg overflow-hidden">
                {section.types.map(({ type, labelKey }, i) => {
                  const enabled = isEnabled(type);
                  return (
                    <div
                      key={type}
                      className={`flex items-center justify-between gap-3 px-3.5 py-3 ${
                        i < section.types.length - 1 ? 'border-b border-subtle' : ''
                      }`}
                    >
                      <span className="text-sm text-text">{t(labelKey)}</span>
                      <Toggle
                        checked={enabled}
                        onChange={(next) =>
                          // The hook already rolls the optimistic flip back on error;
                          // without this the switch just snaps back with no explanation.
                          updatePref.mutate(
                            { type, enabled: next },
                            {
                              onError: () =>
                                showError('errors.updateNotificationPreferenceFailed'),
                            },
                          )
                        }
                        label={t(labelKey)}
                        color={myColor}
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </IonContent>
    </IonPage>
  );
}
