import { useEffect } from 'react';
import { IonApp, IonRouterOutlet, IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Route, Redirect } from 'react-router-dom';
import { calendarOutline, listOutline, peopleOutline } from 'ionicons/icons';

import CalendarPage from './pages/CalendarPage';
import PlansPage from './pages/PlansPage';
import GroupPage from './pages/GroupPage';
import SplashPage from './pages/SplashPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import JoinGroupPage from './pages/JoinGroupPage';

import { useAuthStore } from './stores/auth';

function AppTabs() {
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
          <IonLabel>Calendario</IonLabel>
        </IonTabButton>
        <IonTabButton tab="plans" href="/tabs/plans">
          <IonIcon icon={listOutline} />
          <IonLabel>Quedadas</IonLabel>
        </IonTabButton>
        <IonTabButton tab="group" href="/tabs/group">
          <IonIcon icon={peopleOutline} />
          <IonLabel>Grupo</IonLabel>
        </IonTabButton>
      </IonTabBar>
    </IonTabs>
  );
}

export default function App() {
  return (
    <IonApp>
      <IonReactRouter>
        <IonRouterOutlet>
          <Route exact path="/" component={SplashPage} />
          <Route exact path="/login" component={LoginPage} />
          <Route exact path="/register" component={RegisterPage} />
          <Route path="/tabs" component={AppTabs} />
        </IonRouterOutlet>
      </IonReactRouter>
    </IonApp>
  );
}
