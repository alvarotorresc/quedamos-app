import { useEffect, useState } from 'react';
import { IonPage, IonContent } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';
import { supabase } from '../lib/supabase';
import { takePendingRedirect } from '../lib/pending-redirect';
import { useScreenView } from '../hooks/useAnalytics';

/** Same window ResetPasswordPage gives Supabase to turn a link into a session. */
const VERIFY_TIMEOUT_MS = 8000;

/** Long enough to read "email confirmado" before the app moves on by itself. */
const CONTINUE_DELAY_MS = 2000;

/**
 * Landing spot of the sign-up confirmation email.
 *
 * The link carries the token in the URL and supabase-js turns it into a session on
 * its own; this page just waits for that to happen (the session may already be there
 * when it mounts, or arrive as an auth event a moment later) and then resumes the
 * invite the user parked before signing up. That resume is the whole point: on
 * Android the email used to open the browser, a different origin with a different
 * localStorage, where the parked destination was unreachable.
 */
export default function EmailConfirmedPage() {
  useScreenView('EmailConfirmed');
  const { t } = useTranslation();
  const history = useHistory();
  const [confirmed, setConfirmed] = useState(false);
  const [failed, setFailed] = useState(false);
  // Null until the parked invite is read, which happens exactly once: reading it
  // consumes it, so a re-render must never ask for it again.
  const [destination, setDestination] = useState<string | null>(null);

  useEffect(() => {
    let settled = false;

    const markConfirmed = () => {
      settled = true;
      setConfirmed(true);
      // The session can land after the window already gave up: the link turned out
      // to be good, so drop the failure screen instead of leaving it on top.
      setFailed(false);
    };

    // The session may already exist (the event fired before this mounted).
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) markConfirmed();
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) markConfirmed();
    });

    const timeout = setTimeout(() => {
      if (!settled) setFailed(true);
    }, VERIFY_TIMEOUT_MS);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  // PendingRedirectGate deliberately skips this route, so the parked invite is
  // consumed here instead.
  useEffect(() => {
    if (!confirmed || destination !== null) return;
    setDestination(takePendingRedirect() ?? '/tabs');
  }, [confirmed, destination]);

  // ...and only then does the app move on, once the success message has had a
  // moment on screen.
  useEffect(() => {
    if (destination === null) return;
    const timer = setTimeout(() => history.replace(destination), CONTINUE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [destination, history]);

  return (
    <IonPage>
      <IonContent className="ion-padding">
        <div className="flex flex-col items-center justify-center min-h-full text-center max-w-md mx-auto px-6">
          {confirmed ? (
            <>
              <div className="text-5xl mb-4">✅</div>
              <h1 className="text-xl font-bold text-text">{t('emailConfirmed.title')}</h1>
              <p className="text-text-muted text-sm max-w-[300px] leading-relaxed mt-3">
                {t('emailConfirmed.message')}
              </p>
              <Button onClick={() => history.replace(destination ?? '/tabs')} className="mt-5">
                {t('emailConfirmed.continue')}
              </Button>
            </>
          ) : failed ? (
            <>
              <div className="text-5xl mb-4">⏳</div>
              <h1 className="text-xl font-bold text-text">{t('emailConfirmed.failed.title')}</h1>
              <p className="text-text-muted text-sm max-w-[300px] leading-relaxed mt-3">
                {t('emailConfirmed.failed.message')}
              </p>
              <Button onClick={() => history.replace('/login')} className="mt-5">
                {t('emailConfirmed.failed.login')}
              </Button>
            </>
          ) : (
            <>
              <div className="text-5xl mb-4">📧</div>
              <p className="text-text-muted text-sm">{t('emailConfirmed.waiting')}</p>
            </>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
}
