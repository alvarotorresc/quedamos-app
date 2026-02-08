import { IonPage, IonContent, IonHeader, IonToolbar, IonTitle } from '@ionic/react';

export default function PlansPage() {
  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <IonTitle>Quedadas</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <div className="text-center text-text-muted py-20">
          <p>No hay quedadas programadas</p>
        </div>
      </IonContent>
    </IonPage>
  );
}
