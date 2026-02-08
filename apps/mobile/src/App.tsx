import { useEffect } from 'react';
import { IonApp, IonRouterOutlet, IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, IonSpinner } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Route, Redirect } from 'react-router-dom';
import { calendarOutline, listOutline, peopleOutline } from 'ionicons/icons';
import { useTranslation } from 'react-i18next';

import CalendarPage from './pages/CalendarPage';
import PlansPage from './pages/PlansPage';
import GroupPage from './pages/GroupPage';
import SplashPage from './pages/SplashPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import JoinGroupPage from './pages/JoinGroupPage';

import { useAuthStore } from './stores/auth';

function AppTabs() {
  const { t } = useTranslation();

  return (
    <IonTabs>
      <IonRouterOutlet>
        <Route exact path="/tabs/calendar" component={CalendarPage} />
        <Route exact path="/tabs/plans" component={PlansPage} />
        <Route exact path="/tabs/group" component={GroupPage} />
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

export default function App() {
  const initialize = useAuthStore((s) => s.initialize);
  const isLoading = useAuthStore((s) => s.isLoading);

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (isLoading) {
    return (
      <IonApp>
        <div className="flex items-center justify-center h-screen bg-bg">
          <IonSpinner name="crescent" className="text-primary w-8 h-8" />
        </div>
      </IonApp>
    );
  }

  return (
    <IonApp>
      <IonReactRouter>
        <IonRouterOutlet>
          <GuestRoute exact path="/" component={SplashPage} />
          <GuestRoute exact path="/login" component={LoginPage} />
          <GuestRoute exact path="/register" component={RegisterPage} />
          <GuestRoute exact path="/forgot-password" component={ForgotPasswordPage} />
          <Route exact path="/reset-password" component={ResetPasswordPage} />
          <ProtectedRoute path="/tabs" component={AppTabs} />
          <Route exact path="/join/:code" component={JoinGroupPage} />
        </IonRouterOutlet>
      </IonReactRouter>
    </IonApp>
  );
}
