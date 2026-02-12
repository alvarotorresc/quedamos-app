import { useState, useEffect } from 'react';
import { IonPage, IonContent } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HiOutlineEye, HiOutlineEyeSlash } from 'react-icons/hi2';
import { Button } from '../ui/Button';
import { useAuthStore } from '../stores/auth';
import { supabase } from '../lib/supabase';

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const history = useHistory();
  const updatePassword = useAuthStore((s) => s.updatePassword);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Check if recovery session already exists (event fired before mount)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setReady(true);
      }
    });

    // Also listen for the event in case it hasn't fired yet
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError(t('resetPassword.passwordsMismatch'));
      return;
    }

    if (password.length < 6) {
      setError(t('resetPassword.minLengthError'));
      return;
    }

    setLoading(true);

    try {
      await updatePassword(password);
      setSuccess(true);
      setTimeout(() => history.replace('/tabs'), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('resetPassword.genericError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <IonPage>
      <IonContent className="ion-padding">
        <div className="flex items-center justify-center min-h-full px-6">
        {success ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="text-4xl">✅</div>
            <h2 className="text-lg font-semibold text-text">{t('resetPassword.success.title')}</h2>
            <p className="text-text-muted text-sm">
              {t('resetPassword.success.redirecting')}
            </p>
          </div>
        ) : !ready ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="text-text-muted text-sm">{t('resetPassword.verifying')}</div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-md w-full">
            <h1 className="text-2xl font-bold text-text mb-2">{t('resetPassword.title')}</h1>

            <p className="text-text-muted text-sm">
              {t('resetPassword.description')}
            </p>

            {error && (
              <div className="bg-danger/10 border border-danger/20 rounded-btn p-3 text-danger text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="text-xs text-text-dark block mb-1">{t('resetPassword.newPasswordLabel')}</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-btn px-4 py-3 pr-11 text-text outline-none focus:border-primary"
                  placeholder={t('common.passwordPlaceholder')}
                  minLength={6}
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

            <div>
              <label className="text-xs text-text-dark block mb-1">{t('resetPassword.confirmPasswordLabel')}</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-btn px-4 py-3 pr-11 text-text outline-none focus:border-primary"
                  placeholder={t('common.passwordPlaceholder')}
                  minLength={6}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text transition-colors"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <HiOutlineEyeSlash size={20} /> : <HiOutlineEye size={20} />}
                </button>
              </div>
            </div>

            <Button type="submit" disabled={loading} className="mt-2">
              {loading ? t('resetPassword.submitting') : t('resetPassword.submit')}
            </Button>
          </form>
        )}
        </div>
      </IonContent>
    </IonPage>
  );
}
