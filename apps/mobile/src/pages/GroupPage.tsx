import { IonPage, IonContent, IonHeader, IonToolbar, IonTitle } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { useAuthStore } from '../stores/auth';

export default function GroupPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <IonTitle>{t('group.title')}</IonTitle>
          <div slot="end" className="pr-4">
            <Avatar name={user?.name ?? 'U'} color="#60A5FA" size={32} />
          </div>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <div className="text-center text-text-muted py-10">
          <p className="mb-6">{t('group.noGroup')}</p>
          <div className="flex flex-col gap-3 max-w-[280px] mx-auto">
            <Button>{t('group.createGroup')}</Button>
            <Button variant="secondary">{t('group.joinWithCode')}</Button>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
}
