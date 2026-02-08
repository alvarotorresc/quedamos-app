import { IonPage, IonContent, IonHeader, IonToolbar, IonTitle } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { Avatar } from '../ui/Avatar';
import { useAuthStore } from '../stores/auth';
import { useMyColor } from '../hooks/useMyColor';

export default function PlansPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const myColor = useMyColor();

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar className="py-2">
          <IonTitle>{t('plans.title')}</IonTitle>
          <div slot="end" className="pr-4">
            <Avatar name={user?.name ?? 'U'} color={myColor} size={32} />
          </div>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <div className="text-center text-text-muted py-20 pt-2">
          <p>{t('plans.empty')}</p>
        </div>
      </IonContent>
    </IonPage>
  );
}
