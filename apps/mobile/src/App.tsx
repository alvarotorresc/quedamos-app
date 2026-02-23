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
        <IonRouterOutlet>
          <GuestRoute exact path="/" component={SplashPage} />
          <GuestRoute exact path="/login" component={LoginPage} />
          <GuestRoute exact path="/register" component={RegisterPage} />
          <GuestRoute exact path="/forgot-password" component={ForgotPasswordPage} />
          <Route exact path="/reset-password" component={ResetPasswordPage} />
          <ProtectedRoute path="/tabs" component={AppTabs} />
          <Route exact path="/join/:code" component={JoinGroupPage} />
        </IonRouterOutlet>
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

  // Deep link handler for native app (reset password, join group)
  useEffect(() => {
    const ALLOWED_PREFIXES = ['/reset-password', '/join/', '/tabs/'];
    const listener = CapApp.addListener('appUrlOpen', (event) => {
      try {
        const url = new URL(event.url);
        const path = url.pathname + url.search + url.hash;
        if (path && ALLOWED_PREFIXES.some((p) => path.startsWith(p))) {
          window.location.href = path;
        }
      } catch {
        // Invalid URL — ignore
      }
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
