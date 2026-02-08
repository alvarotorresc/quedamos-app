import { IonPage, IonContent } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';
import logo from '../assets/logo.svg';

export default function SplashPage() {
  const { t } = useTranslation();
  const history = useHistory();

  return (
    <IonPage>
      <IonContent className="ion-padding">
        <div className="flex flex-col items-center justify-center h-full text-center px-10 overflow-hidden relative">
          <div className="absolute top-[-100px] right-[-100px] w-[300px] h-[300px] rounded-full bg-gradient-radial from-primary-dark/10 to-transparent" />
          <div className="absolute bottom-[-80px] left-[-80px] w-[250px] h-[250px] rounded-full bg-gradient-radial from-primary/5 to-transparent" />

          <img src={logo} alt="¿Quedamos?" className="w-16 h-16 mb-3" />
          <h1 className="text-4xl font-extrabold tracking-tight text-text">{t('splash.title')}</h1>
          <p className="text-text-dark text-sm mt-2 mb-7 max-w-[240px] leading-relaxed">
            {t('splash.tagline')}
          </p>

          <div className="flex flex-col gap-3 w-full max-w-[280px]">
            <Button onClick={() => history.push('/login')}>
              {t('splash.login')}
            </Button>
            <Button variant="secondary" onClick={() => history.push('/register')}>
              {t('splash.register')}
            </Button>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
}
