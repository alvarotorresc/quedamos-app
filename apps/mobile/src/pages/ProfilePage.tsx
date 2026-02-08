import { useState } from 'react';
import { IonPage, IonContent, IonHeader, IonToolbar, IonTitle } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/auth';
import { useThemeStore } from '../stores/theme';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { LanguageSelector } from '../ui/LanguageSelector';
import { translateAuthError } from '../lib/auth-errors';

type ExpandedSection = 'name' | 'email' | 'password' | null;

export default function ProfilePage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const updateName = useAuthStore((s) => s.updateName);
  const updateEmail = useAuthStore((s) => s.updateEmail);
  const updatePassword = useAuthStore((s) => s.updatePassword);
  const darkMode = useThemeStore((s) => s.darkMode);
  const toggleTheme = useThemeStore((s) => s.toggle);

  const [expanded, setExpanded] = useState<ExpandedSection>(null);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');

  // Form fields
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const toggleSection = (section: ExpandedSection) => {
    setError('');
    setSuccessMessage('');
    if (expanded === section) {
      setExpanded(null);
    } else {
      setExpanded(section);
      if (section === 'name') setNewName(user?.name ?? '');
      if (section === 'email') setNewEmail('');
      if (section === 'password') {
        setNewPassword('');
        setConfirmPassword('');
      }
    }
  };

  const handleUpdateName = async () => {
    if (!newName.trim()) return;
    setLoading(true);
    setError('');
    try {
      await updateName(newName.trim());
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
    setLoading(true);
    setError('');
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
    if (newPassword.length < 6) {
      setError(t('profile.minLengthError'));
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

  const handleSignOut = async () => {
    await signOut();
    window.location.replace('/');
  };

  const inputClass = 'w-full bg-white/5 border border-white/10 rounded-btn px-4 py-3 text-sm text-text placeholder-text-dark outline-none focus:border-primary/40';

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <IonTitle>{t('profile.title')}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <div className="max-w-md mx-auto px-4">
          {/* Avatar + User Info */}
          <div className="flex flex-col items-center py-6">
            <Avatar name={user?.name ?? '?'} color="#60A5FA" size={72} />
            <h2 className="text-lg font-bold text-text mt-3">{user?.name}</h2>
            <p className="text-sm text-text-muted">{user?.email}</p>
          </div>

          {/* Success message */}
          {successMessage && (
            <div className="bg-success/10 border border-success/20 rounded-btn p-3 text-success text-sm mb-4">
              {successMessage}
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="bg-danger/10 border border-danger/20 rounded-btn p-3 text-danger text-sm mb-4">
              {error}
            </div>
          )}

          {/* Edit sections */}
          <div className="flex flex-col gap-2">
            {/* Edit Name */}
            <div className="bg-white/[0.025] border border-white/5 rounded-btn overflow-hidden">
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
            <div className="bg-white/[0.025] border border-white/5 rounded-btn overflow-hidden">
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
                  <Button onClick={handleUpdateEmail} disabled={loading || !newEmail.trim()}>
                    {loading ? t('profile.sending') : t('profile.sendConfirmation')}
                  </Button>
                </div>
              )}
            </div>

            {/* Change Password */}
            <div className="bg-white/[0.025] border border-white/5 rounded-btn overflow-hidden">
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
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={t('profile.confirmPassword')}
                    className={inputClass}
                  />
                  <Button onClick={handleUpdatePassword} disabled={loading || !newPassword || !confirmPassword}>
                    {loading ? t('profile.saving') : t('profile.save')}
                  </Button>
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
            className="mt-6 w-full bg-white/[0.025] border border-white/5 rounded-btn px-4 py-3.5 flex items-center justify-between"
          >
            <span className="text-sm text-text">{t('profile.theme')}</span>
            <div className={`w-10 h-6 rounded-full relative transition-colors ${darkMode ? 'bg-primary/30' : 'bg-white/10'}`}>
              <div className={`absolute top-0.5 w-5 h-5 rounded-full transition-all ${darkMode ? 'right-0.5 bg-primary' : 'left-0.5 bg-text-dark'}`} />
            </div>
          </button>

          {/* Sign out */}
          <div className="mt-8 mb-8">
            <Button variant="secondary" onClick={handleSignOut} className="w-full text-danger border-danger/20">
              {t('profile.logout')}
            </Button>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
}
