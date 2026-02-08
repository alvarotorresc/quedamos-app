import { IonPage, IonContent, IonHeader, IonToolbar, IonTitle } from '@ionic/react';
import { Button } from '../ui/Button';
import { useAuthStore } from '../stores/auth';

export default function GroupPage() {
  const signOut = useAuthStore((s) => s.signOut);

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <IonTitle>Grupo</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <div className="text-center text-text-muted py-10">
          <p className="mb-6">No perteneces a ningún grupo</p>
          <div className="flex flex-col gap-3 max-w-[280px] mx-auto">
            <Button>Crear grupo</Button>
            <Button variant="secondary">Unirme con código</Button>
          </div>
        </div>

        <div className="mt-20">
          <Button variant="secondary" onClick={signOut} className="w-full text-danger border-danger/20">
            Cerrar sesión
          </Button>
        </div>
      </IonContent>
    </IonPage>
  );
}
