import { useEffect, useState } from 'react';
import { IonApp, IonRouterOutlet, IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, IonSpinner } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Route, Redirect, useLocation, useHistory } from 'react-router-dom';
import { calendarOutline, listOutline, peopleOutline, personOutline } from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import { App as CapApp } from '@capacitor/app';

import CalendarPage from './pages/CalendarPage';
import PlansPage from './pages/PlansPage';
import GroupPage from './pages/GroupPage';
import GroupDetailPage from './pages/GroupDetailPage';
import ProfilePage from './pages/ProfilePage';
import NotificationsSettingsPage from './pages/NotificationsSettingsPage';
import SplashPage from './pages/SplashPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import JoinGroupPage from './pages/JoinGroupPage';
import LandingPage from './pages/LandingPage';

import { useAuthStore } from './stores/auth';
import { useThemeStore } from './stores/theme';
import DesktopFrame from './components/DesktopFrame';
import { usePushNotifications } from './hooks/usePushNotifications';
import { resolveDeepLinkPath, navigateToDeepLink } from './lib/deep-link';
import { takePendingRedirect } from './lib/pending-redirect';

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches,
  );

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)');
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return isDesktop;
}

function AppTabs() {
  const { t } = useTranslation();
  usePushNotifications();

  return (
    <IonTabs>
      <IonRouterOutlet>
        <Route exact path="/tabs/calendar" component={CalendarPage} />
        <Route exact path="/tabs/plans" component={PlansPage} />
        <Route exact path="/tabs/group/:id" component={GroupDetailPage} />
        <Route exact path="/tabs/group" component={GroupPage} />
        <Route exact path="/tabs/profile/notifications" component={NotificationsSettingsPage} />
        <Route exact path="/tabs/profile" component={ProfilePage} />
        <Route exact path="/tabs">
          <Redirect to="/tabs/calendar" />
        </Route>
      </IonRouterOutlet>
      <IonTabBar slot="bottom" className="backdrop-blur-xl">
        <IonTabButton tab="calendar" href="/tabs/calendar">
          <IonIcon icon={calendarOutline} />
          <IonLabel>{t('tabs.calendar')}</IonLabel>
        </IonTabButton>
        <IonTabButton tab="plans" href="/tabs/plans">
          <IonIcon icon={listOutline} />
          <IonLabel>{t('tabs.plans')}</IonLabel>
        </IonTabButton>
        <IonTabButton tab="group" href="/tabs/group">
          <IonIcon icon={peopleOutline} />
          <IonLabel>{t('tabs.group')}</IonLabel>
        </IonTabButton>
        <IonTabButton tab="profile" href="/tabs/profile">
          <IonIcon icon={personOutline} />
          <IonLabel>{t('tabs.profile')}</IonLabel>
        </IonTabButton>
      </IonTabBar>
    </IonTabs>
  );
}

function ProtectedRoute({ component: Component, ...rest }: { component: React.ComponentType; path: string; exact?: boolean }) {
  const user = useAuthStore((s) => s.user);
  return (
    <Route
      {...rest}
      render={() => (user ? <Component /> : <Redirect to="/" />)}
    />
  );
}

/**
 * Resumes the invite someone parked before they had an account.
 *
 * Confirming the sign-up email lands back on the root of the app with a session,
 * where GuestRoute would otherwise send them straight to /tabs and the invite
 * would be lost — same story when they close the app and come back later. This is
 * the single place the parked destination is consumed, whatever route the session
 * shows up on.
 *
 * Two destinations it deliberately leaves alone:
 * - /reset-password, which a Supabase recovery link also opens *with* a session:
 *   jumping to the invite there would strand the user without a new password.
 * - the destination it is already on, because the login form navigates there by
 *   itself; a second replace to the same path would remount the page and join twice.
 */
export function PendingRedirectGate({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const history = useHistory();
  const { pathname, search } = useLocation();

  useEffect(() => {
    if (!user) return;
    if (pathname === '/reset-password') return;
    const pending = takePendingRedirect();
    if (pending && pending !== `${pathname}${search}`) history.replace(pending);
  }, [user, pathname, search, history]);

  return <>{children}</>;
}

function GuestRoute({ component: Component, ...rest }: { component: React.ComponentType; path: string; exact?: boolean }) {
  const user = useAuthStore((s) => s.user);
  return (
    <Route
      {...rest}
      render={() => (user ? <Redirect to="/tabs" /> : <Component />)}
    />
  );
}

/**
 * Inner component rendered inside IonReactRouter.
 * On desktop + guest + path "/" → renders LandingPage full-viewport (no DesktopFrame).
 * Otherwise → renders the normal app inside DesktopFrame + IonApp.
 */
function AppContent() {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  const history = useHistory();
  const isDesktop = useIsDesktop();

  // Desktop + guest + root path → show full-viewport landing page
  if (!user && isDesktop && location.pathname === '/') {
    return (
      <LandingPage
        onLogin={() => history.push('/login')}
        onRegister={() => history.push('/register')}
      />
    );
  }

  // Normal app flow — identical to the original structure
  return (
    <DesktopFrame>
      <IonApp>
        <PendingRedirectGate>
          <IonRouterOutlet>
            <GuestRoute exact path="/" component={SplashPage} />
            <GuestRoute exact path="/login" component={LoginPage} />
            <GuestRoute exact path="/register" component={RegisterPage} />
            <GuestRoute exact path="/forgot-password" component={ForgotPasswordPage} />
            <Route exact path="/reset-password" component={ResetPasswordPage} />
            <ProtectedRoute path="/tabs" component={AppTabs} />
            <Route exact path="/join/:code" component={JoinGroupPage} />
          </IonRouterOutlet>
        </PendingRedirectGate>
      </IonApp>
    </DesktopFrame>
  );
}

export default function App() {
  const initialize = useAuthStore((s) => s.initialize);
  const isLoading = useAuthStore((s) => s.isLoading);
  const initializeTheme = useThemeStore((s) => s.initialize);

  useEffect(() => {
    initialize();
    initializeTheme();
  }, [initialize, initializeTheme]);

  // Deep link handler for native app (reset password, join group).
  // La URL la puede fabricar cualquier app instalada lanzando un Intent VIEW contra
  // MainActivity, así que resolveDeepLinkPath filtra host, esquema y ruta antes de navegar.
  useEffect(() => {
    const listener = CapApp.addListener('appUrlOpen', (event) => {
      const path = resolveDeepLinkPath(event.url);
      if (path) navigateToDeepLink(path);
    });
    return () => {
      listener.then((l) => l.remove());
    };
  }, []);

  if (isLoading) {
    return (
      <DesktopFrame>
        <IonApp>
          <div className="flex items-center justify-center h-screen bg-bg">
            <IonSpinner name="crescent" className="text-primary w-8 h-8" />
          </div>
        </IonApp>
      </DesktopFrame>
    );
  }

  return (
    <IonReactRouter>
      <AppContent />
    </IonReactRouter>
  );
}
