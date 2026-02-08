import { useEffect } from 'react';
import { IonPage, IonContent } from '@ionic/react';
import { useParams, useHistory } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/auth';

export default function JoinGroupPage() {
  const { t } = useTranslation();
  const { code } = useParams<{ code: string }>();
  const history = useHistory();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!user) {
      history.replace(`/login?redirect=/join/${code}`);
      return;
    }

    // TODO: Join group with code
    console.log('Joining group with code:', code);
    history.replace('/tabs/group');
  }, [user, code, history]);

  return (
    <IonPage>
      <IonContent className="ion-padding">
        <div className="flex items-center justify-center h-full">
          <p className="text-text-muted">{t('joinGroup.joining')}</p>
        </div>
      </IonContent>
    </IonPage>
  );
}
