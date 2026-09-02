/** Public URL of the web app, used for invite links, redirects and CORS. */
export const DEFAULT_FRONTEND_URL = 'https://quedamos-app-mobile.vercel.app';

export function getFrontendUrl(): string {
  return process.env.FRONTEND_URL || DEFAULT_FRONTEND_URL;
}

export function corsOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  const origins = [
    DEFAULT_FRONTEND_URL,
    'https://localhost', // Capacitor Android (androidScheme: 'https')
  ];
  if (env.NODE_ENV !== 'production') {
    origins.push('http://localhost:5173', 'http://localhost:8100', 'http://localhost');
  }
  if (env.CORS_ORIGIN) {
    origins.push(env.CORS_ORIGIN);
  }
  return origins;
}
