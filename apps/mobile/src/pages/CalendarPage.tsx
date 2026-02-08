import { IonPage, IonContent, IonHeader, IonToolbar, IonTitle } from '@ionic/react';
import { Avatar } from '../ui/Avatar';
import { useAuthStore } from '../stores/auth';

export default function CalendarPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <IonTitle>Calendario</IonTitle>
          <div slot="end" className="pr-4">
            <Avatar name={user?.name ?? 'U'} color="#60A5FA" size={32} />
          </div>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <div className="text-center text-text-muted py-20">
          <p>Selecciona un grupo para ver el calendario compartido</p>
        </div>
      </IonContent>
    </IonPage>
  );
}
