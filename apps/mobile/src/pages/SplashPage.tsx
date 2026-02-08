import { IonPage, IonContent } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { Button } from '../ui/Button';

export default function SplashPage() {
  const history = useHistory();

  return (
    <IonPage>
      <IonContent className="ion-padding">
        <div className="flex flex-col items-center justify-center h-full text-center px-10">
          <div className="absolute top-[-100px] right-[-100px] w-[300px] h-[300px] rounded-full bg-gradient-radial from-primary-dark/10 to-transparent" />
          <div className="absolute bottom-[-80px] left-[-80px] w-[250px] h-[250px] rounded-full bg-gradient-radial from-primary/5 to-transparent" />

          <div className="text-5xl mb-2">📅</div>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-100">Quedamos</h1>
          <p className="text-text-dark text-sm mt-2 mb-7 max-w-[240px] leading-relaxed">
            El momento perfecto para quedar con tu grupo.
          </p>

          <div className="flex flex-col gap-3 w-full max-w-[280px]">
            <Button onClick={() => history.push('/login')}>
              Iniciar sesión
            </Button>
            <Button variant="secondary" onClick={() => history.push('/register')}>
              Crear cuenta
            </Button>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
}
