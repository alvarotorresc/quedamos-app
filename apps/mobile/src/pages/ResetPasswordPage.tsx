import { useState, useEffect, useMemo } from 'react';
import { IonPage, IonContent } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { HiOutlineEye, HiOutlineEyeSlash } from 'react-icons/hi2';
import { Button } from '../ui/Button';
import { useAuthStore } from '../stores/auth';
import { supabase } from '../lib/supabase';

interface PasswordCheck {
  key: string;
  label: string;
  ok: boolean;
}

function getPasswordChecks(password: string, t: TFunction): PasswordCheck[] {
  return [
    { key: 'minLength', label: t('register.checks.minLength'), ok: password.length >= 8 },
    { key: 'uppercase', label: t('register.checks.uppercase'), ok: /[A-Z]/.test(password) },
    { key: 'number', label: t('register.checks.number'), ok: /\d/.test(password) },
    { key: 'special', label: t('register.checks.special'), ok: /[^A-Za-z0-9]/.test(password) },
  ];
}

function getStrength(checks: PasswordCheck[], t: TFunction): { level: number; label: string; color: string } {
  const passed = checks.filter((c) => c.ok).length;
  if (passed <= 1) return { level: 1, label: t('register.strength.weak'), color: 'bg-danger' };
  if (passed <= 2) return { level: 2, label: t('register.strength.fair'), color: 'bg-warning' };
  if (passed <= 3) return { level: 3, label: t('register.strength.good'), color: 'bg-primary' };
  return { level: 4, label: t('register.strength.strong'), color: 'bg-success' };
}

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

  const checks = useMemo(() => getPasswordChecks(password, t), [password, t]);
  const strength = useMemo(() => getStrength(checks, t), [checks, t]);
  const allChecksPassed = checks.every((c) => c.ok);

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
                  className="w-full bg-bg-input border border-strong rounded-btn px-4 py-3 pr-11 text-text outline-none focus:border-primary"
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
                      <li key={check.key} className={`text-xs flex items-center gap-1.5 ${check.ok ? 'text-success' : 'text-text-dark'}`}>
                        <span>{check.ok ? '\u2713' : '\u2022'}</span>
                        {check.label}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div>
              <label className="text-xs text-text-dark block mb-1">{t('resetPassword.confirmPasswordLabel')}</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-bg-input border border-strong rounded-btn px-4 py-3 pr-11 text-text outline-none focus:border-primary"
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

            <Button type="submit" disabled={loading || !allChecksPassed || password !== confirmPassword} className="mt-2">
              {loading ? t('resetPassword.submitting') : t('resetPassword.submit')}
            </Button>
          </form>
        )}
        </div>
      </IonContent>
    </IonPage>
  );
}
