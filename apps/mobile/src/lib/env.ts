/**
 * The only place that reads `import.meta.env`.
 *
 * Vite inlines `import.meta.env.VITE_X` at build time, so a missing variable does not
 * blow up: it silently becomes `undefined` and whatever depends on it degrades in
 * silence (no push token, no Firebase, an API base URL of "undefined"). This module
 * turns that into a loud, unconditional `console.warn` per missing variable — in
 * production too, because production is exactly where a forgotten Vercel env var goes
 * unnoticed.
 *
 * Every read goes through a static `import.meta.env.VITE_X` access (never a dynamic
 * `env[name]` lookup) so Vite's compile-time replacement still applies, and every read
 * happens on call rather than at module load so tests can `vi.stubEnv` around it.
 */

/** Variables the app cannot work correctly without. */
export const REQUIRED_ENV_VARS = [
  'VITE_API_URL',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
  'VITE_FIREBASE_VAPID_KEY',
] as const;

export type RequiredEnvVar = (typeof REQUIRED_ENV_VARS)[number];

/**
 * Optional on purpose: analytics only, and only on the native app (see `lib/firebase.ts`
 * — the web uses Umami instead), so a missing measurement id is not worth a warning.
 */
type OptionalEnvVar = 'VITE_FIREBASE_MEASUREMENT_ID';

type EnvVar = RequiredEnvVar | OptionalEnvVar;

const READERS: Record<EnvVar, () => unknown> = {
  VITE_API_URL: () => import.meta.env.VITE_API_URL,
  VITE_SUPABASE_URL: () => import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: () => import.meta.env.VITE_SUPABASE_ANON_KEY,
  VITE_FIREBASE_API_KEY: () => import.meta.env.VITE_FIREBASE_API_KEY,
  VITE_FIREBASE_AUTH_DOMAIN: () => import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  VITE_FIREBASE_PROJECT_ID: () => import.meta.env.VITE_FIREBASE_PROJECT_ID,
  VITE_FIREBASE_MESSAGING_SENDER_ID: () => import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  VITE_FIREBASE_APP_ID: () => import.meta.env.VITE_FIREBASE_APP_ID,
  VITE_FIREBASE_VAPID_KEY: () => import.meta.env.VITE_FIREBASE_VAPID_KEY,
  VITE_FIREBASE_MEASUREMENT_ID: () => import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

/** The value of an env var, or `undefined` when it is absent or blank. */
export function readEnv(name: EnvVar): string | undefined {
  const raw = READERS[name]();
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  return trimmed === '' ? undefined : trimmed;
}

/** Which of the required variables are missing right now. */
export function getMissingEnvVars(): RequiredEnvVar[] {
  return REQUIRED_ENV_VARS.filter((name) => readEnv(name) === undefined);
}

/**
 * Warn once per missing required variable. Called from `main.tsx` at startup, and
 * deliberately NOT gated on `import.meta.env.DEV`: a build shipped without one of these
 * is a production incident, and the browser console is the only place it shows.
 */
export function warnMissingEnvVars(): RequiredEnvVar[] {
  const missing = getMissingEnvVars();
  for (const name of missing) {
    console.warn(`[env] Missing ${name}: whatever depends on it will not work.`);
  }
  return missing;
}

export interface FirebaseWebConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  messagingSenderId?: string;
  appId?: string;
  measurementId?: string;
}

/**
 * The Firebase web config, from the env. Shared by `lib/firebase.ts` (the app's own SDK)
 * and by the service worker registration, which forwards it as a query string so
 * `public/firebase-messaging-sw.js` — a classic worker that cannot import this module —
 * has no second copy of its own.
 */
export function getFirebaseWebConfig(): FirebaseWebConfig {
  return {
    apiKey: readEnv('VITE_FIREBASE_API_KEY'),
    authDomain: readEnv('VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: readEnv('VITE_FIREBASE_PROJECT_ID'),
    messagingSenderId: readEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
    appId: readEnv('VITE_FIREBASE_APP_ID'),
    measurementId: readEnv('VITE_FIREBASE_MEASUREMENT_ID'),
  };
}

/**
 * The query string the messaging service worker is registered with. `measurementId` is
 * left out: the worker only needs what `firebase.initializeApp` requires to receive
 * messages, and analytics never runs there.
 */
export function firebaseSwConfigParams(): string {
  const config = getFirebaseWebConfig();
  const params = new URLSearchParams();
  const forwarded = ['apiKey', 'authDomain', 'projectId', 'messagingSenderId', 'appId'] as const;
  for (const key of forwarded) {
    const value = config[key];
    if (value) params.set(key, value);
  }
  return params.toString();
}
