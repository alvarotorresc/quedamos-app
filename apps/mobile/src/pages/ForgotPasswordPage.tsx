import { useState, useRef } from 'react';
import { IonPage, IonContent } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import { Button } from '../ui/Button';
import { useAuthStore } from '../stores/auth';
import { translateAuthError } from '../lib/auth-errors';

const HCAPTCHA_SITEKEY = 'c7aee17a-5df0-43a6-ba90-397e25d83410';

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const history = useHistory();
  const resetPassword = useAuthStore((s) => s.resetPassword);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const captchaRef = useRef<HCaptcha>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const captchaResult = await captchaRef.current?.execute({ async: true });
      const token = captchaResult?.response;
      if (!token) {
        setError(t('common.captchaError'));
        setLoading(false);
        return;
      }

      await resetPassword(email, token);
      setSent(true);
    } catch (err) {
      setError(translateAuthError(err));
      captchaRef.current?.resetCaptcha();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = () => {
    setSent(false);
    captchaRef.current?.resetCaptcha();
  };

  return (
    <IonPage>
      <IonContent className="ion-padding">
        <div className="flex items-center justify-center min-h-full px-6">
        {sent ? (
          <div className="flex flex-col items-center gap-4 text-center max-w-md">
            <div className="text-4xl">📧</div>
            <h2 className="text-lg font-semibold text-text">{t('forgotPassword.success.title')}</h2>
            <p className="text-text-muted text-sm max-w-[300px]">
              {t('forgotPassword.success.message')}
            </p>
            <Button variant="secondary" onClick={handleResend} className="mt-4">
              {t('forgotPassword.success.resend')}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-md w-full">
            <button type="button" onClick={() => history.goBack()} className="self-start text-text-muted text-sm flex items-center gap-1 mb-2">
              <span className="text-lg leading-none">&larr;</span> {t('common.back')}
            </button>

            <h1 className="text-2xl font-bold text-text mb-2">{t('forgotPassword.title')}</h1>

            <p className="text-text-muted text-sm">
              {t('forgotPassword.description')}
            </p>

            {error && (
              <div className="bg-danger/10 border border-danger/20 rounded-btn p-3 text-danger text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="text-xs text-text-dark block mb-1">{t('common.email')}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-btn px-4 py-3 text-text outline-none focus:border-primary"
                placeholder={t('common.emailPlaceholder')}
                required
              />
            </div>

            <HCaptcha ref={captchaRef} sitekey={HCAPTCHA_SITEKEY} size="invisible" />

            <Button type="submit" disabled={loading} className="mt-2">
              {loading ? t('forgotPassword.submitting') : t('forgotPassword.submit')}
            </Button>
          </form>
        )}
        </div>
      </IonContent>
    </IonPage>
  );
}
