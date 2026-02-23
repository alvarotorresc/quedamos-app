import { useState, useRef } from 'react';
import { IonPage, IonContent } from '@ionic/react';
import { useHistory, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HiOutlineEye, HiOutlineEyeSlash } from 'react-icons/hi2';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import { Button } from '../ui/Button';
import { useAuthStore } from '../stores/auth';
import { translateAuthError } from '../lib/auth-errors';

const HCAPTCHA_SITEKEY = 'c7aee17a-5df0-43a6-ba90-397e25d83410';

export default function LoginPage() {
  const { t } = useTranslation();
  const history = useHistory();
  const location = useLocation();
  const signIn = useAuthStore((s) => s.signIn);
  const rawRedirect = new URLSearchParams(location.search).get('redirect') || '/tabs';
  const redirectTo = rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '/tabs';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
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

      await signIn(email, password, token);
      history.replace(redirectTo);
    } catch (err) {
      setError(translateAuthError(err));
      captchaRef.current?.resetCaptcha();
    } finally {
      setLoading(false);
    }
  };

  return (
    <IonPage>
      <IonContent className="ion-padding">
        <div className="flex items-center justify-center min-h-full px-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-md w-full">
          <button type="button" onClick={() => history.goBack()} className="self-start text-text-muted text-sm flex items-center gap-1 mb-2">
            <span className="text-lg leading-none">&larr;</span> {t('common.back')}
          </button>

          <h1 className="text-2xl font-bold text-text mb-2">{t('login.title')}</h1>

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

          <div>
            <label className="text-xs text-text-dark block mb-1">{t('common.password')}</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-btn px-4 py-3 pr-11 text-text outline-none focus:border-primary"
                placeholder={t('common.passwordPlaceholder')}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <HiOutlineEyeSlash size={20} /> : <HiOutlineEye size={20} />}
              </button>
            </div>
          </div>

          <div className="text-right">
            <Link to="/forgot-password" className="text-xs text-primary">
              {t('login.forgotPassword')}
            </Link>
          </div>

          <HCaptcha ref={captchaRef} sitekey={HCAPTCHA_SITEKEY} size="invisible" />

          <Button type="submit" disabled={loading} className="mt-2">
            {loading ? t('login.submitting') : t('login.submit')}
          </Button>
        </form>
        </div>
      </IonContent>
    </IonPage>
  );
}
