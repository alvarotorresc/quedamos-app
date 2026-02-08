import { useState } from 'react';
import { IonPage, IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { Button } from '../ui/Button';
import { useAuthStore } from '../stores/auth';

export default function LoginPage() {
  const history = useHistory();
  const signIn = useAuthStore((s) => s.signIn);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
      history.replace('/tabs');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/" text="" />
          </IonButtons>
          <IonTitle>Iniciar sesión</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-8">
          {error && (
            <div className="bg-danger/10 border border-danger/20 rounded-btn p-3 text-danger text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="text-xs text-text-dark block mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-btn px-4 py-3 text-text outline-none focus:border-primary"
              placeholder="tu@email.com"
              required
            />
          </div>

          <div>
            <label className="text-xs text-text-dark block mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-btn px-4 py-3 text-text outline-none focus:border-primary"
              placeholder="••••••••"
              required
            />
          </div>

          <Button type="submit" disabled={loading} className="mt-2">
            {loading ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>
      </IonContent>
    </IonPage>
  );
}
