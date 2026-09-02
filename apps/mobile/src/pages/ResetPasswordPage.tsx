import { useState, useEffect, useMemo } from 'react';
import { IonPage, IonContent } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HiOutlineEye, HiOutlineEyeSlash } from 'react-icons/hi2';
import { Button } from '../ui/Button';
import { useAuthStore } from '../stores/auth';
import { supabase } from '../lib/supabase';
import { getPasswordChecks, getStrength } from '../lib/password-utils';

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const history = useHistory();
  const updatePassword = useAuthStore((s) => s.updatePassword);
  const signOut = useAuthStore((s) => s.signOut);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [expired, setExpired] = useState(false);
  const [success, setSuccess] = useState(false);

  const checks = useMemo(() => getPasswordChecks(password, t), [password, t]);
  const strength = useMemo(() => getStrength(checks, t), [checks, t]);
  const allChecksPassed = checks.every((c) => c.ok);

  useEffect(() => {
    let settled = false;

    const markReady = () => {
      settled = true;
      setReady(true);
      // The event can land after the verification window already gave up — the
      // link turned out to be valid, so drop the expired screen instead of
      // leaving it on top of a working recovery session.
      setExpired(false);
    };

    // Check if recovery session already exists (event fired before mount)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) markReady();
    });

    // Also listen for the event in case it hasn't fired yet
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') markReady();
    });

    // No recovery session and no event within the window → link is invalid/expired
    const timeout = setTimeout(() => {
      if (!settled) setExpired(true);
    }, 8000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  // A dead recovery link can still have left a half-open recovery session behind.
  // Clear it before sending the user back for a fresh link, so the next one starts
  // from a clean slate. A failing sign-out must not strand them on this screen.
  const handleResend = async () => {
    await signOut().catch(() => {});
    history.replace('/forgot-password');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!allChecksPassed) {
      setError(t('register.passwordRequirementsError'));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('resetPassword.passwordsMismatch'));
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
              <h2 className="text-lg font-semibold text-text">
                {t('resetPassword.success.title')}
              </h2>
              <p className="text-text-muted text-sm">{t('resetPassword.success.redirecting')}</p>
            </div>
          ) : expired ? (
            <div className="flex flex-col items-center gap-4 text-center max-w-md w-full">
              <div className="text-4xl">⏳</div>
              <h2 className="text-lg font-semibold text-text">
                {t('resetPassword.expired.title')}
              </h2>
              <p className="text-text-muted text-sm">{t('resetPassword.expired.message')}</p>
              <Button onClick={handleResend} className="mt-2">
                {t('resetPassword.expired.resend')}
              </Button>
            </div>
          ) : !ready ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="text-text-muted text-sm">{t('resetPassword.verifying')}</div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-md w-full">
              <h1 className="text-2xl font-bold text-text mb-2">{t('resetPassword.title')}</h1>

              <p className="text-text-muted text-sm">{t('resetPassword.description')}</p>

              {error && (
                <div className="bg-error-tint border border-subtle rounded-btn p-3 text-danger text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="text-xs text-text-dark block mb-1">
                  {t('resetPassword.newPasswordLabel')}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-bg-input border border-strong rounded-btn px-4 py-3 pr-11 text-text focus:border-primary"
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

                {password.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1 flex-1">
                        {[1, 2, 3, 4].map((i) => (
                          <div
                            key={i}
                            className={`h-1 flex-1 rounded-full transition-colors ${
                              i <= strength.level ? strength.color : 'bg-toggle-off'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-text-muted">{strength.label}</span>
                    </div>

                    <ul className="space-y-1">
                      {checks.map((check) => (
                        <li
                          key={check.key}
                          className={`text-xs flex items-center gap-1.5 ${check.ok ? 'text-success' : 'text-text-dark'}`}
                        >
                          <span>{check.ok ? '\u2713' : '\u2022'}</span>
                          {check.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs text-text-dark block mb-1">
                  {t('resetPassword.confirmPasswordLabel')}
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-bg-input border border-strong rounded-btn px-4 py-3 pr-11 text-text focus:border-primary"
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
                    {showConfirmPassword ? (
                      <HiOutlineEyeSlash size={20} />
                    ) : (
                      <HiOutlineEye size={20} />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading || !allChecksPassed || password !== confirmPassword}
                className="mt-2"
              >
                {loading ? t('resetPassword.submitting') : t('resetPassword.submit')}
              </Button>
            </form>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
}
