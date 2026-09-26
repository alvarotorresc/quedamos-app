import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MARTA_EMAIL,
  findSupabaseSession,
  fixedClock,
  parseDotEnv,
  patchSupabaseSession,
  readShotsEnv,
} from '../src/env.ts';

test('parseDotEnv ignora comentarios y líneas rotas y quita comillas', () => {
  const vars = parseDotEnv(
    '# demo\nDEMO_PASSWORD_ALVARO="a"\nexport DEMO_PASSWORD_MARTA=\'s3cr=t\'\n\nSEED_TODAY=2026-10-01\nROTA\n',
  );
  assert.deepEqual(vars, {
    DEMO_PASSWORD_ALVARO: 'a',
    DEMO_PASSWORD_MARTA: 's3cr=t',
    SEED_TODAY: '2026-10-01',
  });
});

test('readShotsEnv exige las dos claves y dice cuáles faltan', () => {
  assert.throws(() => readShotsEnv({}), /DEMO_PASSWORD_MARTA, SEED_TODAY/);
  assert.throws(() => readShotsEnv({ DEMO_PASSWORD_MARTA: 'x' }), /SEED_TODAY/);
});

test('readShotsEnv rechaza fechas mal formadas o imposibles', () => {
  const base = { DEMO_PASSWORD_MARTA: 'x' };
  assert.throws(() => readShotsEnv({ ...base, SEED_TODAY: '01/10/2026' }), /SEED_TODAY/);
  assert.throws(() => readShotsEnv({ ...base, SEED_TODAY: '2026-02-30' }), /SEED_TODAY/);
});

test('readShotsEnv usa el correo fijo de Marta', () => {
  assert.equal(MARTA_EMAIL, 'demo-marta@quedamos.alvarotc.com');
  assert.deepEqual(readShotsEnv({ DEMO_PASSWORD_MARTA: 'x', SEED_TODAY: '2026-10-01' }), {
    email: 'demo-marta@quedamos.alvarotc.com',
    password: 'x',
    seedToday: '2026-10-01',
  });
});

test('fixedClock pone la fecha sembrada con la hora actual, también en el futuro', () => {
  const now = new Date(2026, 8, 26, 17, 45, 10);
  const fixed = fixedClock('2026-10-01', now);
  assert.equal(fixed.getFullYear(), 2026);
  assert.equal(fixed.getMonth(), 9);
  assert.equal(fixed.getDate(), 1);
  assert.equal(fixed.getHours(), 17);
  assert.equal(fixed.getMinutes(), 45);
  assert.ok(fixed.getTime() > now.getTime());
});

const session = {
  access_token: 'jwt-real',
  refresh_token: 'rt-real',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: 1_790_000_000,
  user: { id: 'u1' },
};

test('findSupabaseSession localiza la clave sb-*-auth-token del storageState', () => {
  const state = {
    cookies: [],
    origins: [
      {
        origin: 'https://quedamos.alvarotc.com',
        localStorage: [
          { name: 'quedamos-lang', value: 'es' },
          { name: 'sb-abc123-auth-token', value: JSON.stringify(session) },
        ],
      },
    ],
  };
  assert.deepEqual(findSupabaseSession(state), { name: 'sb-abc123-auth-token', value: JSON.stringify(session) });
  assert.equal(findSupabaseSession({ origins: [] }), null);
  assert.equal(findSupabaseSession(null), null);
});

test('patchSupabaseSession adelanta expires_at al reloj fijado sin tocar los tokens', () => {
  const fixedMs = Date.UTC(2026, 9, 1, 15, 30, 0, 700);
  const patched: unknown = JSON.parse(patchSupabaseSession(JSON.stringify(session), fixedMs));
  assert.deepEqual(patched, {
    ...session,
    expires_at: Math.floor(fixedMs / 1000) + 3600,
    expires_in: 3600,
  });
});

test('patchSupabaseSession falla si la sesión no es legible o no tiene tokens', () => {
  assert.throws(() => patchSupabaseSession('no-json', 0), /sesión/);
  assert.throws(() => patchSupabaseSession(JSON.stringify({ expires_at: 1 }), 0), /sesión/);
});
