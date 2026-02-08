import { useEffect, useState } from 'react';
import { IonPage, IonContent, IonSpinner } from '@ionic/react';
import { useParams, useHistory } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/auth';
import { useJoinGroup } from '../hooks/useGroups';
import { Button } from '../ui/Button';

export default function JoinGroupPage() {
  const { t } = useTranslation();
  const { code } = useParams<{ code: string }>();
  const history = useHistory();
  const user = useAuthStore((s) => s.user);
  const joinGroup = useJoinGroup();

  const [status, setStatus] = useState<'joining' | 'success' | 'error'>('joining');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!user) {
      history.replace(`/login?redirect=/join/${code}`);
      return;
    }

    const cleanCode = code.replace(/\D/g, '');

    if (cleanCode.length !== 8) {
      setStatus('error');
      setErrorMessage(t('joinGroup.invalidCode'));
      return;
    }

    joinGroup.mutateAsync(cleanCode)
      .then((group) => {
        setStatus('success');
        setTimeout(() => {
          history.replace(`/tabs/group/${group.id}`);
        }, 1000);
      })
      .catch((e: unknown) => {
        setStatus('error');
        const message = e instanceof Error ? e.message : '';
        if (message.includes('Already a member')) {
          setErrorMessage(t('group.alreadyMember'));
        } else {
          setErrorMessage(t('joinGroup.error'));
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, code]);

  return (
    <IonPage>
      <IonContent className="ion-padding">
        <div className="flex flex-col items-center justify-center h-full px-6 gap-4">
          {status === 'joining' && (
            <>
              <IonSpinner name="crescent" className="text-primary w-8 h-8" />
              <p className="text-text-muted">{t('joinGroup.joining')}</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="text-4xl mb-2">🎉</div>
              <p className="text-text font-semibold">{t('joinGroup.success')}</p>
              <p className="text-text-muted text-sm">{t('joinGroup.redirecting')}</p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="text-4xl mb-2">😕</div>
              <p className="text-danger font-semibold">{errorMessage}</p>
              <Button onClick={() => history.replace('/tabs/group')} className="mt-4">
                {t('joinGroup.goToGroups')}
              </Button>
            </>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
}
