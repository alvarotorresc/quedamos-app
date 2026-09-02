import { useState, useMemo } from 'react';
import { IonPage, IonContent, IonHeader, IonToolbar } from '@ionic/react';
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
import { SegmentedPills } from '../ui/SegmentedPills';
import { Aro } from '../ui/Aro';
import { Tile } from '../ui/Tile';
import { Toggle } from '../ui/Toggle';
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
import {
  HiOutlineBell,
  HiOutlineMoon,
  HiOutlineClock,
  HiOutlineGlobeAlt,
  HiOutlineChatBubbleOvalLeftEllipsis,
  HiOutlineUser,
  HiOutlineArrowTopRightOnSquare,
} from 'react-icons/hi2';
import { useNotificationPreferences } from '../hooks/useNotificationPreferences';
import { NOTIF_SECTIONS } from '../services/notification-preferences';
import { FEEDBACK_FORM_URL } from '../lib/constants';

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
  const { t, i18n } = useTranslation();
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
  const { data: notifPrefs } = useNotificationPreferences();

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

  const notifTypes = NOTIF_SECTIONS.flatMap((section) => section.types);
  const enabledNotif = notifTypes.filter(
    ({ type }) => notifPrefs?.find((p) => p.type === type)?.enabled ?? true,
  ).length;
  const groupCount = groups?.length ?? 0;
  const lang = i18n.language?.startsWith('es') ? 'es' : 'en';
  const slotRows: { key: 'morning' | 'afternoon' | 'night'; start: keyof TimeSlotPreferences; end: keyof TimeSlotPreferences; color: string }[] = [
    { key: 'morning', start: 'morningStart', end: 'morningEnd', color: '#F59E0B' },
    { key: 'afternoon', start: 'afternoonStart', end: 'afternoonEnd', color: myColor },
    { key: 'night', start: 'nightStart', end: 'nightEnd', color: '#A78BFA' },
  ];
  const accountRowClass =
    'w-full flex items-center justify-between gap-3 py-2 text-[13px] bg-transparent border-none text-left';
  const editorClass = 'pb-3 flex flex-col gap-3';

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar className="py-2" />
      </IonHeader>
      <IonContent className="ion-padding">
        <div className="max-w-md mx-auto px-4 pt-2 pb-6">
          {/* Cabecera */}
          <div className="mb-3">
            <h1 className="text-[27px] font-extrabold tracking-tight text-text">{t('profile.title')}</h1>
            <p className="font-mono text-[10px] tracking-[0.16em] uppercase text-text-muted">
              {t('profile.subtitle')}
            </p>
          </div>

          {/* Identidad */}
          <div className="flex items-center gap-3.5 px-1 pt-1.5 pb-4">
            <Aro members={[{ color: myColor, state: 'on' }]} size={84}>
              <Avatar name={user?.name ?? '?'} color={myColor} size={56} />
            </Aro>
            <div className="min-w-0">
              <h2 className="text-[22px] font-extrabold tracking-tight text-text leading-tight truncate">
                {user?.name}
              </h2>
              <p className="text-xs text-text-muted mt-0.5 truncate">{user?.email}</p>
              <p
                className="font-mono text-[10px] tracking-[0.12em] uppercase mt-2"
                style={{ color: myColor }}
              >
                {t('profile.yourColor')} · {t('profile.groupsCount', { count: groupCount })}
              </p>
            </div>
          </div>

          {successMessage && (
            <div className="bg-success-tint border border-subtle rounded-btn p-3 text-success text-sm mb-3">
              {successMessage}
            </div>
          )}
          {error && (
            <div className="bg-error-tint border border-subtle rounded-btn p-3 text-danger text-sm mb-3">
              {error}
            </div>
          )}

          {/* Mosaico */}
          <div className="grid grid-cols-2 gap-2.5">
            <Tile
              label={t('profile.tiles.notifications')}
              icon={<HiOutlineBell className="w-4 h-4" />}
              onClick={() => history.push('/tabs/profile/notifications')}
            >
              <div>
                <p className="text-[22px] font-extrabold leading-none text-text">{enabledNotif}</p>
                <p className="text-[11px] text-text-muted mt-1">
                  {t('profile.tiles.activeOf', { total: notifTypes.length })}
                </p>
              </div>
            </Tile>

            <Tile label={t('profile.tiles.theme')} icon={<HiOutlineMoon className="w-4 h-4" />}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-text">
                  {darkMode ? t('profile.tiles.dark') : t('profile.tiles.light')}
                </span>
                <Toggle checked={darkMode} onChange={toggleTheme} label={t('profile.theme')} color={myColor} />
              </div>
            </Tile>

            <Tile label={t('profile.tiles.timeSlots')} icon={<HiOutlineClock className="w-4 h-4" />} span={2}>
              <button
                type="button"
                onClick={() => toggleSection('timeSlots')}
                aria-expanded={expanded === 'timeSlots'}
                className="w-full flex gap-1.5 bg-transparent border-none p-0 text-left"
              >
                {slotRows.map(({ key, start, end, color }) => (
                  <div key={key} className="flex-1 min-w-0">
                    <div className="h-1.5 rounded-pill" style={{ background: color }} />
                    <p className="text-[10px] text-text-muted mt-1">{t(`profile.timeSlots.${key}`)}</p>
                    <p className="font-mono text-[10px] text-text-dark">
                      {slotPrefs[start]}–{slotPrefs[end]}
                    </p>
                  </div>
                ))}
              </button>
              {expanded === 'timeSlots' && (
                <div className="flex flex-col gap-3 pt-1">
                  {slotRows.map(({ key, start, end }) => (
                    <div key={key}>
                      <label className="text-xs text-text-dark block mb-1.5">
                        {t(`profile.timeSlots.${key}`)}
                      </label>
                      <div className="flex items-center gap-2">
                        <select
                          value={slotPrefs[start]}
                          onChange={(e) => updateSlotField(start, e.target.value)}
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
                          value={slotPrefs[end]}
                          onChange={(e) => updateSlotField(end, e.target.value)}
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
                  ))}
                  {slotValidationError && (
                    <p className="text-danger text-xs">
                      {t(`profile.timeSlots.${SLOT_ERROR_KEYS[slotValidationError]}`)}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleResetTimeSlots}
                      className="px-3 py-2.5 rounded-btn text-xs font-semibold text-text-dark bg-bg-hover border border-subtle"
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
            </Tile>

            <Tile label={t('settings.language')} icon={<HiOutlineGlobeAlt className="w-4 h-4" />}>
              <SegmentedPills
                options={[
                  { value: 'es', label: 'ES' },
                  { value: 'en', label: 'EN' },
                ]}
                value={lang}
                onChange={(code) => i18n.changeLanguage(code)}
                className="self-start"
              />
            </Tile>

            <Tile
              label={t('profile.tiles.help')}
              icon={<HiOutlineChatBubbleOvalLeftEllipsis className="w-4 h-4" />}
            >
              <a
                href={FEEDBACK_FORM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-2 text-[13px] text-text no-underline"
              >
                <span>{t('profile.reportBug')}</span>
                <HiOutlineArrowTopRightOnSquare className="w-3.5 h-3.5 text-text-dark shrink-0" />
              </a>
            </Tile>

            <Tile label={t('profile.tiles.account')} icon={<HiOutlineUser className="w-4 h-4" />} span={2}>
              <div className="flex flex-col">
                {/* Nombre */}
                <button
                  type="button"
                  onClick={() => toggleSection('name')}
                  aria-expanded={expanded === 'name'}
                  className={accountRowClass}
                >
                  <span className="text-text">{t('profile.name')}</span>
                  <span className="text-text-muted truncate">{user?.name}</span>
                </button>
                {expanded === 'name' && (
                  <div className={editorClass}>
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

                {/* Email */}
                <button
                  type="button"
                  onClick={() => toggleSection('email')}
                  aria-expanded={expanded === 'email'}
                  className={accountRowClass}
                >
                  <span className="text-text">{t('profile.email')}</span>
                  <span className="text-text-muted truncate">{user?.email}</span>
                </button>
                {expanded === 'email' && (
                  <div className={editorClass}>
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

                {/* Contraseña */}
                <button
                  type="button"
                  onClick={() => toggleSection('password')}
                  aria-expanded={expanded === 'password'}
                  className={accountRowClass}
                >
                  <span className="text-text">{t('profile.password')}</span>
                  <span className="text-text-muted">••••••••</span>
                </button>
                {expanded === 'password' && (
                  <div className={editorClass}>
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
                              <span>{check.ok ? '✓' : '•'}</span>
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
            </Tile>
          </div>

          {/* Cerrar sesión */}
          <button
            type="button"
            onClick={handleSignOut}
            className="mt-5 w-full py-3 text-[13px] font-bold text-danger bg-transparent border-none"
          >
            {t('profile.logout')}
          </button>
        </div>
      </IonContent>
    </IonPage>
  );
}
