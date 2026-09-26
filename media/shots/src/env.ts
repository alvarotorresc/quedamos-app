import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SHOTS_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const MEDIA_ROOT = join(SHOTS_ROOT, '..');
export const OUT_ROOT = join(MEDIA_ROOT, 'out');
export const SEED_ENV_PATH = join(MEDIA_ROOT, 'seed', '.env');
export const BASE_URL = 'https://quedamos.alvarotc.com';

/** Correo fijo de la cuenta de captura (lo crea la siembra). */
export const MARTA_EMAIL = 'demo-marta@quedamos.alvarotc.com';
/** Vida que se le da a la sesión parcheada, contada desde el reloj fijado. */
const SESSION_SECONDS = 3600;

export interface ShotsEnv {
  email: string;
  password: string;
  /** Día que la siembra toma como «hoy», AAAA-MM-DD. */
  seedToday: string;
  /** De la .env de mobile (MOBILE_ENV_PATH en media/seed/.env). */
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export function parseDotEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).replace(/^export\s+/, '').trim();
    let value = line.slice(eq + 1).trim();
    const quote = value[0];
    if (value.length >= 2 && (quote === '"' || quote === "'") && value.endsWith(quote)) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function readShotsEnv(
  vars: Readonly<Record<string, string | undefined>>,
): Pick<ShotsEnv, 'email' | 'password' | 'seedToday'> {
  const password = vars.DEMO_PASSWORD_MARTA ?? '';
  const seedToday = vars.SEED_TODAY ?? '';
  const entries: Array<[string, string]> = [
    ['DEMO_PASSWORD_MARTA', password],
    ['SEED_TODAY', seedToday],
  ];
  const missing = entries.filter(([, value]) => value === '').map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(`media/seed/.env: faltan ${missing.join(', ')}`);
  }
  if (!isIsoDate(seedToday)) {
    throw new Error(`media/seed/.env: SEED_TODAY debe ser AAAA-MM-DD y existir, no «${seedToday}»`);
  }
  return { email: MARTA_EMAIL, password, seedToday };
}

/** VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY de la .env de mobile que apunta MOBILE_ENV_PATH. */
export function readMobileSupabaseEnv(vars: Readonly<Record<string, string | undefined>>): {
  supabaseUrl: string;
  supabaseAnonKey: string;
} {
  const supabaseUrl = vars.VITE_SUPABASE_URL ?? '';
  const supabaseAnonKey = vars.VITE_SUPABASE_ANON_KEY ?? '';
  const missing: string[] = [];
  if (supabaseUrl === '') missing.push('VITE_SUPABASE_URL');
  if (supabaseAnonKey === '') missing.push('VITE_SUPABASE_ANON_KEY');
  if (missing.length > 0) {
    throw new Error(`.env de mobile (MOBILE_ENV_PATH): faltan ${missing.join(', ')}`);
  }
  return { supabaseUrl: supabaseUrl.replace(/\/+$/, ''), supabaseAnonKey };
}

export function loadShotsEnv(path: string = SEED_ENV_PATH): ShotsEnv {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    throw new Error(`No existe ${path}: lanza antes la siembra (media/seed)`);
  }
  const seedVars = parseDotEnv(text);
  const base = readShotsEnv(seedVars);
  const mobileEnvPath = seedVars.MOBILE_ENV_PATH;
  if (!mobileEnvPath) throw new Error(`${path}: falta MOBILE_ENV_PATH`);
  let mobileText: string;
  try {
    mobileText = readFileSync(mobileEnvPath, 'utf8');
  } catch {
    throw new Error(`No existe el fichero de MOBILE_ENV_PATH indicado en ${path}`);
  }
  const { supabaseUrl, supabaseAnonKey } = readMobileSupabaseEnv(parseDotEnv(mobileText));
  return { ...base, supabaseUrl, supabaseAnonKey };
}

/**
 * Fecha para page.clock.setFixedTime: el día sembrado con la hora actual. Puede estar en
 * el futuro (SEED_TODAY = 2026-10-01): patchSupabaseSession evita que eso dispare refrescos.
 */
export function fixedClock(seedToday: string, now: Date): Date {
  const [y, m, d] = seedToday.split('-').map(Number);
  const fixed = new Date(now);
  fixed.setFullYear(y ?? 0, (m ?? 1) - 1, d ?? 1);
  return fixed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** La entrada `sb-<ref>-auth-token` del localStorage de un storageState de Playwright. */
export function findSupabaseSession(state: unknown): { name: string; value: string } | null {
  if (!isRecord(state) || !Array.isArray(state.origins)) return null;
  for (const origin of state.origins) {
    if (!isRecord(origin) || !Array.isArray(origin.localStorage)) continue;
    for (const item of origin.localStorage) {
      if (!isRecord(item) || typeof item.name !== 'string' || typeof item.value !== 'string') continue;
      if (/^sb-.+-auth-token$/.test(item.name)) return { name: item.name, value: item.value };
    }
  }
  return null;
}

/**
 * El "ref" con el que supabase-js hace de namespace la sesión: el primer subdominio del
 * host (ver SupabaseClient: `sb-${baseUrl.hostname.split('.')[0]}-auth-token`).
 */
export function supabaseProjectRef(supabaseUrl: string): string {
  const ref = new URL(supabaseUrl).hostname.split('.')[0];
  if (!ref) throw new Error('No se pudo obtener el ref de Supabase de la URL');
  return ref;
}

/** Clave de localStorage donde supabase-js guarda la sesión (el cliente no usa storageKey propia). */
export function supabaseStorageKey(supabaseUrl: string): string {
  return `sb-${supabaseProjectRef(supabaseUrl)}-auth-token`;
}

/** Cuerpo de la respuesta de POST /auth/v1/token?grant_type=password. */
export interface SupabasePasswordGrantResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
  token_type: string;
  user: unknown;
}

export interface SupabaseSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: number;
  token_type: string;
  user: unknown;
}

/**
 * El objeto que supabase-js v2 guarda en localStorage tras un login (GoTrueClient._saveSession
 * clona la sesión tal cual). Si el servidor no manda expires_at, se calcula como el resto del
 * cliente (ver auth-js _sessionResponse): ahora + expires_in.
 */
export function buildSupabaseSession(response: SupabasePasswordGrantResponse): SupabaseSession {
  if (!response.access_token || !response.refresh_token) {
    throw new Error('La respuesta de login no tiene access_token/refresh_token');
  }
  return {
    access_token: response.access_token,
    refresh_token: response.refresh_token,
    expires_in: response.expires_in,
    expires_at: response.expires_at ?? Math.floor(Date.now() / 1000) + response.expires_in,
    token_type: response.token_type,
    user: response.user,
  };
}

/**
 * Con el reloj del navegador fijado en SEED_TODAY, supabase-js compararía el expires_at
 * real con un «ahora» futuro, vería el token caducado y refrescaría en bucle. Se adelanta
 * expires_at a (reloj fijado + 1 h) sin tocar access_token ni refresh_token: el JWT sigue
 * siendo válido para el servidor porque el login es de esta misma ejecución.
 */
export function patchSupabaseSession(value: string, fixedEpochMs: number): string {
  let session: unknown;
  try {
    session = JSON.parse(value);
  } catch {
    throw new Error('La sesión de Supabase guardada no es JSON');
  }
  if (!isRecord(session) || typeof session.access_token !== 'string' || typeof session.refresh_token !== 'string') {
    throw new Error('La sesión de Supabase guardada no tiene access_token/refresh_token');
  }
  return JSON.stringify({
    ...session,
    expires_at: Math.floor(fixedEpochMs / 1000) + SESSION_SECONDS,
    expires_in: SESSION_SECONDS,
  });
}
