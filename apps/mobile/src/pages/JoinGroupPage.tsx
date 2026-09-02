import { useEffect, useRef, useState } from 'react';
import { IonPage, IonContent, IonSpinner } from '@ionic/react';
import { useParams, useHistory } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/auth';
import { useJoinGroup } from '../hooks/useGroups';
import { useScreenView } from '../hooks/useAnalytics';
import { Button } from '../ui/Button';
import { ApiError } from '../lib/api';

export default function JoinGroupPage() {
  useScreenView('JoinGroup');
  const { t } = useTranslation();
  const { code } = useParams<{ code: string }>();
  const history = useHistory();
  const user = useAuthStore((s) => s.user);
  const joinGroup = useJoinGroup();

  const [status, setStatus] = useState<'joining' | 'success' | 'error'>('joining');
  const [errorMessage, setErrorMessage] = useState('');

  const joinedCodeRef = useRef<string | null>(null);
  // True for as long as this component instance is actually on screen. A plain
  // per-effect-run flag isn't enough: StrictMode mounts, cleans up, and remounts
  // effects synchronously in dev, which would otherwise mark the in-flight
  // request "cancelled" even though the component never really went away.
  const mountedRef = useRef(true);
  const navTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Safety net for real unmount: the join effect below may have last run
      // its early-return branch (StrictMode re-run for the same code), which
      // registers no cleanup of its own, so this is the only cleanup
      // guaranteed to fire and clear a pending nav timeout.
      if (navTimeoutRef.current) {
        clearTimeout(navTimeoutRef.current);
        navTimeoutRef.current = undefined;
      }
    };
  }, []);

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

    // Guard against duplicate joins: re-runs for the same code (StrictMode
    // double-invoke, or any lingering user re-render) must not fire twice.
    if (joinedCodeRef.current === cleanCode) return;
    joinedCodeRef.current = cleanCode;

    // A stale result is one where the page is gone, or the tracked code has
    // moved on to a different join link — not merely "this effect run's
    // cleanup fired", since StrictMode fires that for the same code too.
    const isStale = () => !mountedRef.current || joinedCodeRef.current !== cleanCode;

    joinGroup
      .mutateAsync(cleanCode)
      .then((group) => {
        if (isStale()) return;
        setStatus('success');
        navTimeoutRef.current = setTimeout(() => {
          history.replace(`/tabs/group/${group.id}`);
        }, 1000);
      })
      .catch((e: unknown) => {
        if (isStale()) return;
        setStatus('error');
        if (e instanceof ApiError && e.status === 409) {
          setErrorMessage(t('group.alreadyMember'));
        } else {
          setErrorMessage(t('joinGroup.error'));
        }
      });

    return () => {
      // Not redundant with the mount effect's clear above: this fires when
      // [user, code] change without a real unmount (e.g. a still-pending nav
      // timeout from a success right before the user identity changes), a
      // window the mount effect's cleanup never sees.
      if (navTimeoutRef.current) {
        clearTimeout(navTimeoutRef.current);
        navTimeoutRef.current = undefined;
      }
    };
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
