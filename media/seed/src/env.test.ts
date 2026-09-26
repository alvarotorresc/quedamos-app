import { chmodSync, mkdtempSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { generatePassword, loadConfig, parseDotenv, passwordVar, savePassword } from './env.js';

const API_ENV = 'DATABASE_URL="postgres://fake"\nSUPABASE_URL=https://fake.supabase.co/\nSUPABASE_SERVICE_KEY=fake-service\n';
const MOBILE_ENV = 'VITE_SUPABASE_URL=https://fake.supabase.co\nVITE_SUPABASE_ANON_KEY=fake-anon\n';

function fixture(options: { apiEnv?: string; seedExtra?: string; seedToday?: string } = {}): string {
  const dir = mkdtempSync(join(tmpdir(), 'seed-env-'));
  writeFileSync(join(dir, 'api.env'), options.apiEnv ?? API_ENV);
  writeFileSync(join(dir, 'mobile.env'), MOBILE_ENV);
  const seedPath = join(dir, 'seed.env');
  writeFileSync(
    seedPath,
    `API_ENV_PATH=${join(dir, 'api.env')}\nMOBILE_ENV_PATH=${join(dir, 'mobile.env')}\n` +
      `SEED_TODAY=${options.seedToday ?? '2026-10-01'}\n${options.seedExtra ?? ''}`,
  );
  return seedPath;
}

describe('parseDotenv', () => {
  it('entiende comentarios, comillas, export, CRLF y = dentro del valor', () => {
    const text = "A=1\n# comentario\nexport B=\"x=y\"\r\nC='z'\n\nlinea rara\nA=2\n";
    expect(parseDotenv(text)).toEqual({ A: '2', B: 'x=y', C: 'z' });
  });
});

describe('loadConfig', () => {
  it('lee las claves por nombre desde los .env indicados', () => {
    const config = loadConfig(fixture({ seedExtra: 'DEMO_PASSWORD_MARTA=pw-m\n' }));
    expect(config.supabaseUrl).toBe('https://fake.supabase.co');
    expect(config.serviceKey).toBe('fake-service');
    expect(config.anonKey).toBe('fake-anon');
    expect(config.apiUrl).toBe('https://quedamos.api.alvarotc.com');
    expect(config.seedToday).toBe('2026-10-01');
    expect(config.passwords).toEqual({ marta: 'pw-m' });
  });

  it('nombra la variable que falta sin enseñar ningún valor', () => {
    const seedPath = fixture({ apiEnv: 'SUPABASE_URL=https://fake.supabase.co\n' });
    expect(() => loadConfig(seedPath)).toThrow(/SUPABASE_SERVICE_KEY/);
    try {
      loadConfig(seedPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).not.toContain('fake-anon');
      expect(message).not.toContain('https://fake');
    }
  });

  it('falla si un fichero de entorno no existe', () => {
    const seedPath = fixture({ seedExtra: 'API_ENV_PATH=/no/existe/api.env\n' });
    expect(() => loadConfig(seedPath)).toThrow(/No existe el fichero/);
  });

  it('rechaza un SEED_TODAY imposible', () => {
    expect(() => loadConfig(fixture({ seedToday: '2026-02-30' }))).toThrow(/Fecha no válida/);
  });
});

describe('savePassword', () => {
  it('añade la contraseña y loadConfig la recupera', () => {
    const seedPath = fixture();
    savePassword(seedPath, 'hugo', 'pw-h');
    expect(passwordVar('hugo')).toBe('DEMO_PASSWORD_HUGO');
    expect(loadConfig(seedPath).passwords.hugo).toBe('pw-h');
  });

  it('deja el fichero en 0600 aunque ya existiera con permisos más abiertos', () => {
    const seedPath = fixture();
    chmodSync(seedPath, 0o644);
    savePassword(seedPath, 'hugo', 'pw-h');
    expect(statSync(seedPath).mode & 0o777).toBe(0o600);
  });
});

describe('generatePassword', () => {
  it('es larga, distinta cada vez y apta para un .env sin comillas', () => {
    const a = generatePassword();
    const b = generatePassword();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(30);
    expect(a).toMatch(/^[A-Za-z0-9_-]+Aa1!$/);
  });
});
