import { IonPage, IonContent, IonHeader, IonToolbar, IonTitle } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';
import { LanguageSelector } from '../ui/LanguageSelector';
import { useAuthStore } from '../stores/auth';

export default function GroupPage() {
  const { t } = useTranslation();
  const signOut = useAuthStore((s) => s.signOut);

  const handleSignOut = async () => {
    await signOut();
    window.location.replace('/');
  };

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <IonTitle>{t('group.title')}</IonTitle>
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

        <div className="mt-10 max-w-[280px] mx-auto">
          <p className="text-xs text-text-dark mb-2">{t('settings.language')}</p>
          <LanguageSelector />
        </div>

        <div className="mt-10">
          <Button variant="secondary" onClick={handleSignOut} className="w-full text-danger border-danger/20">
            {t('group.logout')}
          </Button>
        </div>
      </IonContent>
    </IonPage>
  );
}
