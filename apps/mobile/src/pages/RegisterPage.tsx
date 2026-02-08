import { useState, useMemo, useRef } from 'react';
import { IonPage, IonContent } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import { Button } from '../ui/Button';
import { useAuthStore } from '../stores/auth';
import { translateAuthError } from '../lib/auth-errors';

const HCAPTCHA_SITEKEY = 'c7aee17a-5df0-43a6-ba90-397e25d83410';

interface PasswordCheck {
  label: string;
  ok: boolean;
}

function getPasswordChecks(password: string): PasswordCheck[] {
  return [
    { label: 'Al menos 8 caracteres', ok: password.length >= 8 },
    { label: 'Una letra mayúscula', ok: /[A-Z]/.test(password) },
    { label: 'Un número', ok: /\d/.test(password) },
    { label: 'Un carácter especial (!@#$...)', ok: /[^A-Za-z0-9]/.test(password) },
  ];
}

function getStrength(checks: PasswordCheck[]): { level: number; label: string; color: string } {
  const passed = checks.filter((c) => c.ok).length;
  if (passed <= 1) return { level: 1, label: 'Débil', color: 'bg-danger' };
  if (passed <= 2) return { level: 2, label: 'Regular', color: 'bg-warning' };
  if (passed <= 3) return { level: 3, label: 'Buena', color: 'bg-primary' };
  return { level: 4, label: 'Fuerte', color: 'bg-success' };
}

export default function RegisterPage() {
  const history = useHistory();
  const signUp = useAuthStore((s) => s.signUp);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  const captchaRef = useRef<HCaptcha>(null);

  const checks = useMemo(() => getPasswordChecks(password), [password]);
  const strength = useMemo(() => getStrength(checks), [checks]);
  const allChecksPassed = checks.every((c) => c.ok);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!allChecksPassed) {
      setError('La contraseña no cumple todos los requisitos');
      return;
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setLoading(true);

    try {
      const captchaResult = await captchaRef.current?.execute({ async: true });
      const token = captchaResult?.response;
      if (!token) {
        setError('No se pudo verificar el captcha. Inténtalo de nuevo.');
        setLoading(false);
        return;
      }

      await signUp(email, password, name, token);
      setRegistered(true);
    } catch (err) {
      setError(translateAuthError(err));
      captchaRef.current?.resetCaptcha();
    } finally {
      setLoading(false);
    }
  };

  if (registered) {
    return (
      <IonPage>
        <IonContent className="ion-padding">
          <div className="flex flex-col items-center justify-center min-h-full text-center max-w-md mx-auto px-6">
            <div className="text-5xl mb-4">📧</div>
            <h2 className="text-xl font-bold text-text">Revisa tu email</h2>
            <p className="text-text-muted text-sm max-w-[300px] leading-relaxed mt-3">
              Te hemos enviado un email de confirmación a <span className="text-primary font-medium">{email}</span>.
              Haz click en el enlace para activar tu cuenta.
            </p>
            <p className="text-text-dark text-xs mt-3">
              Si no lo ves, revisa la carpeta de spam.
            </p>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonContent className="ion-padding">
        <div className="flex items-center justify-center min-h-full px-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-md w-full">
          <button type="button" onClick={() => history.goBack()} className="self-start text-text-muted text-sm flex items-center gap-1 mb-2">
            <span className="text-lg leading-none">&larr;</span> Volver
          </button>

          <h1 className="text-2xl font-bold text-text mb-2">Crear cuenta</h1>

          {error && (
            <div className="bg-danger/10 border border-danger/20 rounded-btn p-3 text-danger text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="text-xs text-text-dark block mb-1">Nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-btn px-4 py-3 text-text outline-none focus:border-primary"
              placeholder="Tu nombre"
              required
            />
          </div>

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

            {password.length > 0 && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1 flex-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          i <= strength.level ? strength.color : 'bg-white/10'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-text-muted">{strength.label}</span>
                </div>

                <ul className="space-y-1">
                  {checks.map((check) => (
                    <li key={check.label} className={`text-xs flex items-center gap-1.5 ${check.ok ? 'text-success' : 'text-text-dark'}`}>
                      <span>{check.ok ? '\u2713' : '\u2022'}</span>
                      {check.label}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs text-text-dark block mb-1">Repetir contraseña</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={`w-full bg-white/5 border rounded-btn px-4 py-3 text-text outline-none focus:border-primary ${
                confirmPassword.length > 0 && password !== confirmPassword
                  ? 'border-danger/50'
                  : 'border-white/10'
              }`}
              placeholder="••••••••"
              required
            />
            {confirmPassword.length > 0 && password !== confirmPassword && (
              <p className="text-danger text-xs mt-1">Las contraseñas no coinciden</p>
            )}
          </div>

          <HCaptcha ref={captchaRef} sitekey={HCAPTCHA_SITEKEY} size="invisible" />

          <Button
            type="submit"
            disabled={loading || !allChecksPassed || password !== confirmPassword}
            className="mt-2"
          >
            {loading ? 'Creando...' : 'Crear cuenta'}
          </Button>
        </form>
        </div>
      </IonContent>
    </IonPage>
  );
}
