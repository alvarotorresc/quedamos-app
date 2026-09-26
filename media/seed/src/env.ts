import { randomBytes } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { USER_KEYS, parseIsoDate, type UserKey } from './plan.js';

export const DEFAULT_API_URL = 'https://quedamos.api.alvarotc.com';
export const DEFAULT_SEED_ENV_PATH = fileURLToPath(new URL('../.env', import.meta.url));

export interface SeedConfig {
  supabaseUrl: string;
  serviceKey: string;
  anonKey: string;
  apiUrl: string;
  seedToday: string;
  passwords: Partial<Record<UserKey, string>>;
  seedEnvPath: string;
}

export function parseDotenv(text: string): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).replace(/^export\s+/, '').trim();
    let value = line.slice(eq + 1).trim();
    const quoted =
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")));
    if (quoted) value = value.slice(1, -1);
    vars[key] = value;
  }
  return vars;
}

function readEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) throw new Error(`No existe el fichero de entorno ${path}`);
  return parseDotenv(readFileSync(path, 'utf8'));
}

function requireVar(vars: Record<string, string>, key: string, source: string): string {
  const value = vars[key];
  if (!value) throw new Error(`Falta la variable ${key} en ${source}`);
  return value;
}

export function passwordVar(key: UserKey): string {
  return `DEMO_PASSWORD_${key.toUpperCase()}`;
}

export function loadConfig(seedEnvPath: string = DEFAULT_SEED_ENV_PATH): SeedConfig {
  const seed = readEnvFile(seedEnvPath);
  const apiEnvPath = requireVar(seed, 'API_ENV_PATH', seedEnvPath);
  const mobileEnvPath = requireVar(seed, 'MOBILE_ENV_PATH', seedEnvPath);
  const seedToday = requireVar(seed, 'SEED_TODAY', seedEnvPath);
  parseIsoDate(seedToday);

  const api = readEnvFile(apiEnvPath);
  const mobile = readEnvFile(mobileEnvPath);

  const passwords: Partial<Record<UserKey, string>> = {};
  for (const key of USER_KEYS) {
    const value = seed[passwordVar(key)];
    if (value) passwords[key] = value;
  }

  return {
    supabaseUrl: requireVar(api, 'SUPABASE_URL', apiEnvPath).replace(/\/+$/, ''),
    serviceKey: requireVar(api, 'SUPABASE_SERVICE_KEY', apiEnvPath),
    anonKey: requireVar(mobile, 'VITE_SUPABASE_ANON_KEY', mobileEnvPath),
    apiUrl: (seed.API_URL || DEFAULT_API_URL).replace(/\/+$/, ''),
    seedToday,
    passwords,
    seedEnvPath,
  };
}

export function savePassword(seedEnvPath: string, key: UserKey, password: string): void {
  appendFileSync(seedEnvPath, `\n${passwordVar(key)}=${password}\n`, { mode: 0o600 });
}

/** 32 caracteres base64url más un sufijo que cumple cualquier política de complejidad. */
export function generatePassword(): string {
  return `${randomBytes(24).toString('base64url')}Aa1!`;
}
