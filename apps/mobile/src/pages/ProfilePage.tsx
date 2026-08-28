import { useState, useMemo } from 'react';
import { IonPage, IonContent, IonHeader, IonToolbar, IonTitle } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useIonViewWillEnter } from '@ionic/react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/auth';
import { useThemeStore } from '../stores/theme';
import { useMyColor } from '../hooks/useMyColor';
import { useScreenView } from '../hooks/useAnalytics';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { LanguageSelector } from '../ui/LanguageSelector';
import { translateAuthError } from '../lib/auth-errors';
import { getPasswordChecks, getStrength } from '../lib/password-utils';
import {
  DEFAULT_TIME_SLOTS,
  validateTimeSlots,
  type TimeSlotPreferences,
  type TimeSlotError,
} from '../lib/time-slot-utils';
import { broadcastSync } from '../lib/group-sync';
import { useGroups } from '../hooks/useGroups';
import { HiOutlineBell, HiOutlineChevronRight } from 'react-icons/hi2';

type ExpandedSection = 'name' | 'email' | 'password' | 'timeSlots' | null;

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, '0');
  const m = i % 2 === 0 ? '00' : '30';
  return `${h}:${m}`;
});

const SLOT_ERROR_KEYS: Record<NonNullable<TimeSlotError>, string> = {
  format_invalid: 'formatInvalid',
  morning_invalid: 'morningInvalid',
  afternoon_invalid: 'afternoonInvalid',
  night_invalid: 'nightInvalid',
  morning_overlaps_afternoon: 'morningOverlapsAfternoon',
  afternoon_overlaps_night: 'afternoonOverlapsNight',
};

export default function ProfilePage() {
  useScreenView('Profile');
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const updateName = useAuthStore((s) => s.updateName);
  const updateEmail = useAuthStore((s) => s.updateEmail);
  const updatePassword = useAuthStore((s) => s.updatePassword);
  const updateTimeSlots = useAuthStore((s) => s.updateTimeSlots);
  const myColor = useMyColor();
  const darkMode = useThemeStore((s) => s.darkMode);
  const toggleTheme = useThemeStore((s) => s.toggle);
  const history = useHistory();

  // Refresh session when entering profile to pick up email changes confirmed externally
  useIonViewWillEnter(() => {
    supabase.auth.refreshSession().catch(() => {
      // Silent failure is acceptable here — the user is already logged in
    });
  });

  const [expanded, setExpanded] = useState<ExpandedSection>(null);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');

  // Form fields
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [slotPrefs, setSlotPrefs] = useState<TimeSlotPreferences>({ ...DEFAULT_TIME_SLOTS });

  const { data: groups } = useGroups();

  // Password strength
  const passwordChecks = useMemo(() => getPasswordChecks(newPassword, t), [newPassword, t]);
  const passwordStrength = useMemo(() => getStrength(passwordChecks, t), [passwordChecks, t]);
  const allChecksPassed = passwordChecks.every((c) => c.ok);
  const slotValidationError = useMemo(() => validateTimeSlots(slotPrefs), [slotPrefs]);

  const toggleSection = (section: ExpandedSection) => {
    setError('');
    setSuccessMessage('');
    if (expanded === section) {
      setExpanded(null);
    } else {
      setExpanded(section);
      if (section === 'name') setNewName(user?.name ?? '');
      if (section === 'email') {
        setNewEmail('');
        setConfirmEmail('');
      }
      if (section === 'password') {
        setNewPassword('');
        setConfirmPassword('');
      }
      if (section === 'timeSlots') {
        setSlotPrefs(user?.timeSlots ? { ...user.timeSlots } : { ...DEFAULT_TIME_SLOTS });
      }
    }
  };

  const handleUpdateName = async () => {
    if (!newName.trim()) return;
    setLoading(true);
    setError('');
    try {
      await updateName(newName.trim());
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      queryClient.invalidateQueries({ queryKey: ['availability'] });
      groups?.forEach((g) => broadcastSync(g.id, 'members'));
      setSuccessMessage(t('profile.nameUpdated'));
      setExpanded(null);
    } catch (e) {
      setError(translateAuthError(e));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateEmail = async () => {
    if (!newEmail.trim()) return;
    setError('');
    if (newEmail.trim().toLowerCase() === user?.email?.toLowerCase()) {
      setError(t('profile.sameEmailError'));
      return;
    }
    if (newEmail.trim().toLowerCase() !== confirmEmail.trim().toLowerCase()) {
      setError(t('profile.emailsMismatch'));
      return;
    }
    setLoading(true);
    try {
      await updateEmail(newEmail.trim());
      setSuccessMessage(t('profile.emailSent'));
      setExpanded(null);
    } catch (e) {
      setError(translateAuthError(e));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    setError('');
    if (!allChecksPassed) {
      setError(t('register.passwordRequirementsError'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('profile.passwordsMismatch'));
      return;
    }
    setLoading(true);
    try {
      await updatePassword(newPassword);
      setSuccessMessage(t('profile.passwordUpdated'));
      setExpanded(null);
      setNewPassword('');
      setConfirmPassword('');
    } catch (e) {
      setError(translateAuthError(e));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTimeSlots = async () => {
    setError('');
    if (slotValidationError) {
      setError(t(`profile.timeSlots.${SLOT_ERROR_KEYS[slotValidationError]}`));
      return;
    }
    setLoading(true);
    try {
      await updateTimeSlots(slotPrefs);
      setSuccessMessage(t('profile.timeSlots.updated'));
      setExpanded(null);
    } catch (e) {
      setError(translateAuthError(e));
    } finally {
      setLoading(false);
    }
  };

  const handleResetTimeSlots = () => {
    setSlotPrefs({ ...DEFAULT_TIME_SLOTS });
  };

  const updateSlotField = (field: keyof TimeSlotPreferences, value: string) => {
    setSlotPrefs((prev) => ({ ...prev, [field]: value }));
  };

  const handleSignOut = async () => {
    await signOut();
    window.location.replace('/');
  };

  const inputClass =
    'w-full bg-bg-input border border-strong rounded-btn px-4 py-3 text-sm text-text placeholder-text-dark outline-none focus:border-primary';

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar className="py-2">
          <IonTitle>{t('profile.title')}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <div className="max-w-md mx-auto px-4 pt-2">
          {/* Avatar + User Info */}
          <div className="flex flex-col items-center py-6">
            <Avatar name={user?.name ?? '?'} color={myColor} size={72} />
            <h2 className="text-lg font-bold text-text mt-3">{user?.name}</h2>
            <p className="text-sm text-text-muted">{user?.email}</p>
          </div>

          {/* Success message */}
          {successMessage && (
            <div className="bg-success-tint border border-subtle rounded-btn p-3 text-success text-sm mb-4">
              {successMessage}
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="bg-error-tint border border-subtle rounded-btn p-3 text-danger text-sm mb-4">
              {error}
            </div>
          )}

          {/* Edit sections */}
          <div className="flex flex-col gap-2">
            {/* Edit Name */}
            <div className="bg-bg-card border border-subtle rounded-btn overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection('name')}
                className="w-full flex items-center justify-between px-4 py-3.5 text-sm text-text"
              >
                <span>{t('profile.editName')}</span>
                <span className="text-text-dark">{expanded === 'name' ? '−' : '+'}</span>
              </button>
              {expanded === 'name' && (
                <div className="px-4 pb-4 flex flex-col gap-3">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder={t('profile.newName')}
                    className={inputClass}
                  />
                  <Button onClick={handleUpdateName} disabled={loading || !newName.trim()}>
                    {loading ? t('profile.saving') : t('profile.save')}
                  </Button>
                </div>
              )}
            </div>

            {/* Change Email */}
            <div className="bg-bg-card border border-subtle rounded-btn overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection('email')}
                className="w-full flex items-center justify-between px-4 py-3.5 text-sm text-text"
              >
                <span>{t('profile.changeEmail')}</span>
                <span className="text-text-dark">{expanded === 'email' ? '−' : '+'}</span>
              </button>
              {expanded === 'email' && (
                <div className="px-4 pb-4 flex flex-col gap-3">
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder={t('profile.newEmail')}
                    className={inputClass}
                  />
                  <input
                    type="email"
                    value={confirmEmail}
                    onChange={(e) => setConfirmEmail(e.target.value)}
                    placeholder={t('profile.confirmEmail')}
                    className={`${inputClass} ${
                      confirmEmail.length > 0 &&
                      newEmail.trim().toLowerCase() !== confirmEmail.trim().toLowerCase()
                        ? '!border-error'
                        : ''
                    }`}
                  />
                  {confirmEmail.length > 0 &&
                    newEmail.trim().toLowerCase() !== confirmEmail.trim().toLowerCase() && (
                      <p className="text-danger text-xs -mt-1">{t('profile.emailsMismatch')}</p>
                    )}
                  <Button
                    onClick={handleUpdateEmail}
                    disabled={
                      loading ||
                      !newEmail.trim() ||
                      newEmail.trim().toLowerCase() !== confirmEmail.trim().toLowerCase()
                    }
                  >
                    {loading ? t('profile.sending') : t('profile.sendConfirmation')}
                  </Button>
                </div>
              )}
            </div>

            {/* Change Password */}
            <div className="bg-bg-card border border-subtle rounded-btn overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection('password')}
                className="w-full flex items-center justify-between px-4 py-3.5 text-sm text-text"
              >
                <span>{t('profile.changePassword')}</span>
                <span className="text-text-dark">{expanded === 'password' ? '−' : '+'}</span>
              </button>
              {expanded === 'password' && (
                <div className="px-4 pb-4 flex flex-col gap-3">
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={t('profile.newPassword')}
                    className={inputClass}
                  />
                  {newPassword.length > 0 && (
                    <div className="space-y-2 -mt-1">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1 flex-1">
                          {[1, 2, 3, 4].map((i) => (
                            <div
                              key={i}
                              className={`h-1 flex-1 rounded-full transition-colors ${
                                i <= passwordStrength.level
                                  ? passwordStrength.color
                                  : 'bg-toggle-off'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-xs text-text-muted">{passwordStrength.label}</span>
                      </div>
                      <ul className="space-y-1">
                        {passwordChecks.map((check) => (
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
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={t('profile.confirmPassword')}
                    className={`${inputClass} ${
                      confirmPassword.length > 0 && newPassword !== confirmPassword
                        ? '!border-error'
                        : ''
                    }`}
                  />
                  {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                    <p className="text-danger text-xs -mt-1">{t('profile.passwordsMismatch')}</p>
                  )}
                  <Button
                    onClick={handleUpdatePassword}
                    disabled={loading || !allChecksPassed || newPassword !== confirmPassword}
                  >
                    {loading ? t('profile.saving') : t('profile.save')}
                  </Button>
                </div>
              )}
            </div>

            {/* Time Slots */}
            <div className="bg-bg-card border border-subtle rounded-btn overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection('timeSlots')}
                className="w-full flex items-center justify-between px-4 py-3.5 text-sm text-text"
              >
                <span>{t('profile.timeSlots.title')}</span>
                <span className="text-text-dark">{expanded === 'timeSlots' ? '−' : '+'}</span>
              </button>
              {expanded === 'timeSlots' && (
                <div className="px-4 pb-4 flex flex-col gap-3">
                  {/* Morning */}
                  <div>
                    <label className="text-xs text-text-dark block mb-1.5">
                      {t('profile.timeSlots.morning')}
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        value={slotPrefs.morningStart}
                        onChange={(e) => updateSlotField('morningStart', e.target.value)}
                        className={inputClass}
                      >
                        {TIME_OPTIONS.map((time) => (
                          <option key={time} value={time}>
                            {time}
                          </option>
                        ))}
                      </select>
                      <span className="text-text-dark text-xs shrink-0">–</span>
                      <select
                        value={slotPrefs.morningEnd}
                        onChange={(e) => updateSlotField('morningEnd', e.target.value)}
                        className={inputClass}
                      >
                        {TIME_OPTIONS.map((time) => (
                          <option key={time} value={time}>
                            {time}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Afternoon */}
                  <div>
                    <label className="text-xs text-text-dark block mb-1.5">
                      {t('profile.timeSlots.afternoon')}
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        value={slotPrefs.afternoonStart}
                        onChange={(e) => updateSlotField('afternoonStart', e.target.value)}
                        className={inputClass}
                      >
                        {TIME_OPTIONS.map((time) => (
                          <option key={time} value={time}>
                            {time}
                          </option>
                        ))}
                      </select>
                      <span className="text-text-dark text-xs shrink-0">–</span>
                      <select
                        value={slotPrefs.afternoonEnd}
                        onChange={(e) => updateSlotField('afternoonEnd', e.target.value)}
                        className={inputClass}
                      >
                        {TIME_OPTIONS.map((time) => (
                          <option key={time} value={time}>
                            {time}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Night */}
                  <div>
                    <label className="text-xs text-text-dark block mb-1.5">
                      {t('profile.timeSlots.night')}
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        value={slotPrefs.nightStart}
                        onChange={(e) => updateSlotField('nightStart', e.target.value)}
                        className={inputClass}
                      >
                        {TIME_OPTIONS.map((time) => (
                          <option key={time} value={time}>
                            {time}
                          </option>
                        ))}
                      </select>
                      <span className="text-text-dark text-xs shrink-0">–</span>
                      <select
                        value={slotPrefs.nightEnd}
                        onChange={(e) => updateSlotField('nightEnd', e.target.value)}
                        className={inputClass}
                      >
                        {TIME_OPTIONS.map((time) => (
                          <option key={time} value={time}>
                            {time}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Real-time validation warning */}
                  {slotValidationError && (
                    <p className="text-danger text-xs">
                      {t(`profile.timeSlots.${SLOT_ERROR_KEYS[slotValidationError]}`)}
                    </p>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleResetTimeSlots}
                      className="px-3 py-2.5 rounded-btn text-xs font-semibold text-text-dark"
                      style={{
                        background: 'var(--app-bg-hover)',
                        border: '1px solid var(--app-border)',
                      }}
                    >
                      {t('profile.timeSlots.resetDefaults')}
                    </button>
                    <Button
                      onClick={handleUpdateTimeSlots}
                      disabled={loading || slotValidationError !== null}
                      className="flex-1"
                    >
                      {loading ? t('profile.saving') : t('profile.save')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Language */}
          <div className="mt-6">
            <p className="text-xs text-text-dark mb-2">{t('settings.language')}</p>
            <LanguageSelector />
          </div>

          {/* Theme toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="mt-6 w-full bg-bg-card border border-subtle rounded-btn px-4 py-3.5 flex items-center justify-between"
          >
            <span className="text-sm text-text">{t('profile.theme')}</span>
            <div
              className={`w-10 h-6 rounded-full relative transition-colors ${darkMode ? 'bg-primary-tint' : 'bg-toggle-off'}`}
            >
              <div
                className={`absolute top-0.5 w-5 h-5 rounded-full transition-all ${darkMode ? 'right-0.5 bg-primary' : 'left-0.5 bg-text-dark'}`}
              />
            </div>
          </button>

          {/* Notifications link */}
          <button
            type="button"
            onClick={() => history.push('/tabs/profile/notifications')}
            className="mt-6 w-full bg-bg-card border border-subtle rounded-btn px-4 py-3.5 flex items-center justify-between"
          >
            <span className="flex items-center gap-3">
              <HiOutlineBell className="w-5 h-5 text-text-dark" />
              <span className="text-sm text-text">{t('profile.notifications.title')}</span>
            </span>
            <HiOutlineChevronRight className="w-4 h-4 text-text-dark" />
          </button>

          {/* Report bug */}
          <div className="mt-6">
            <a
              href="https://forms.gle/4n8mdUksbHRo8wvH6"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-bg-card border border-subtle rounded-btn px-4 py-3.5 flex items-center justify-between"
            >
              <span className="text-sm text-text">{t('profile.reportBug')}</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-4 h-4 text-text-dark"
              >
                <path
                  fillRule="evenodd"
                  d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5zm7.25-.75a.75.75 0 01.75-.75h3.5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0V6.31l-5.47 5.47a.75.75 0 01-1.06-1.06l5.47-5.47H12.25a.75.75 0 01-.75-.75z"
                  clipRule="evenodd"
                />
              </svg>
            </a>
          </div>

          {/* Sign out */}
          <div className="mt-8 mb-8">
            <Button variant="danger" onClick={handleSignOut} className="w-full">
              {t('profile.logout')}
            </Button>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
}
