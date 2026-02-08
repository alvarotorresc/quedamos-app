import { useState, useEffect } from 'react';
import { IonPage, IonContent } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { Button } from '../ui/Button';
import { useAuthStore } from '../stores/auth';
import { supabase } from '../lib/supabase';

export default function ResetPasswordPage() {
  const history = useHistory();
  const updatePassword = useAuthStore((s) => s.updatePassword);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Check if recovery session already exists (event fired before mount)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setReady(true);
      }
    });

    // Also listen for the event in case it hasn't fired yet
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setLoading(true);

    try {
      await updatePassword(password);
      setSuccess(true);
      setTimeout(() => history.replace('/tabs'), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cambiar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <IonPage>
      <IonContent className="ion-padding">
        <div className="flex items-center justify-center min-h-full px-6">
        {success ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="text-4xl">✅</div>
            <h2 className="text-lg font-semibold text-text">Contraseña actualizada</h2>
            <p className="text-text-muted text-sm">
              Redirigiendo...
            </p>
          </div>
        ) : !ready ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="text-text-muted text-sm">Verificando enlace...</div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-md w-full">
            <h1 className="text-2xl font-bold text-text mb-2">Nueva contraseña</h1>

            <p className="text-text-muted text-sm">
              Introduce tu nueva contraseña.
            </p>

            {error && (
              <div className="bg-danger/10 border border-danger/20 rounded-btn p-3 text-danger text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="text-xs text-text-dark block mb-1">Nueva contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-btn px-4 py-3 text-text outline-none focus:border-primary"
                placeholder="••••••••"
                minLength={6}
                required
              />
            </div>

            <div>
              <label className="text-xs text-text-dark block mb-1">Confirmar contraseña</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-btn px-4 py-3 text-text outline-none focus:border-primary"
                placeholder="••••••••"
                minLength={6}
                required
              />
            </div>

            <Button type="submit" disabled={loading} className="mt-2">
              {loading ? 'Guardando...' : 'Cambiar contraseña'}
            </Button>
          </form>
        )}
        </div>
      </IonContent>
    </IonPage>
  );
}
