import { describe, expect, it } from 'vitest';
import { HttpError, createRequester, paceFor, retryAfterMs, type FetchLike } from './http.js';
import { createAdminClient, login } from './clients.js';

interface Call {
  url: string;
  init: RequestInit | undefined;
}

function fakeClock(): { now: () => number; sleep: (ms: number) => Promise<void>; sleeps: number[] } {
  let t = 0;
  const sleeps: number[] = [];
  return {
    now: () => t,
    sleep: async (ms: number) => {
      sleeps.push(ms);
      t += ms;
    },
    sleeps,
  };
}

function scripted(responses: Response[]): { fetch: FetchLike; calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    fetch: async (url, init) => {
      calls.push({ url, init });
      const next = responses.shift();
      if (!next) throw new Error('sin respuesta preparada');
      return next;
    },
  };
}

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function headersOf(call: Call | undefined): Record<string, string> {
  return (call?.init?.headers ?? {}) as Record<string, string>;
}

describe('createRequester', () => {
  it('envía JSON y devuelve la respuesta parseada', async () => {
    const clock = fakeClock();
    const server = scripted([json(201, { id: 'g1' })]);
    const request = createRequester({ fetch: server.fetch, sleep: clock.sleep, now: clock.now });
    const result = await request<{ id: string }>('POST', 'https://api.test/groups', {
      headers: { authorization: 'Bearer t' },
      body: { name: 'x' },
    });
    expect(result).toEqual({ id: 'g1' });
    expect(server.calls[0]?.init?.method).toBe('POST');
    expect(server.calls[0]?.init?.body).toBe('{"name":"x"}');
    expect(headersOf(server.calls[0])['content-type']).toBe('application/json');
  });

  it('devuelve undefined con un 204', async () => {
    const clock = fakeClock();
    const server = scripted([new Response(null, { status: 204 })]);
    const request = createRequester({ fetch: server.fetch, sleep: clock.sleep, now: clock.now });
    expect(await request('DELETE', 'https://api.test/auth/me')).toBeUndefined();
  });

  it('lanza HttpError con estado y ruta, sin filtrar cabeceras', async () => {
    const clock = fakeClock();
    const server = scripted([json(403, { message: 'Forbidden' })]);
    const request = createRequester({ fetch: server.fetch, sleep: clock.sleep, now: clock.now });
    const error = await request('DELETE', 'https://api.test/groups/abc', {
      headers: { authorization: 'Bearer secret-token' },
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({ status: 403, path: '/groups/abc' });
    expect(String(error)).not.toContain('secret-token');
  });

  it('respeta Retry-After ante un 429 y reintenta', async () => {
    const clock = fakeClock();
    const server = scripted([json(429, {}, { 'retry-after': '2' }), json(200, { ok: true })]);
    const request = createRequester({ fetch: server.fetch, sleep: clock.sleep, now: clock.now });
    expect(await request('GET', 'https://api.test/groups')).toEqual({ ok: true });
    expect(clock.sleeps).toContain(2000);
  });

  it('se rinde al tercer 429', async () => {
    const clock = fakeClock();
    const server = scripted([json(429, {}), json(429, {}), json(429, {})]);
    const request = createRequester({ fetch: server.fetch, sleep: clock.sleep, now: clock.now });
    await expect(request('GET', 'https://api.test/groups')).rejects.toMatchObject({ status: 429 });
    expect(clock.sleeps.filter((ms) => ms === 60000)).toHaveLength(2);
  });

  it('espacia las llamadas a la misma ruta aunque cambie el UUID', async () => {
    const clock = fakeClock();
    const server = scripted([json(201, {}), json(201, {})]);
    const request = createRequester({ fetch: server.fetch, sleep: clock.sleep, now: clock.now });
    await request('POST', 'https://api.test/groups/11111111-1111-4111-8111-111111111111/availability', { body: {} });
    await request('POST', 'https://api.test/groups/22222222-2222-4222-8222-222222222222/availability', { body: {} });
    expect(clock.sleeps).toEqual([3500]);
  });
});

describe('paceFor y retryAfterMs', () => {
  it('aplica los límites del throttler', () => {
    expect(paceFor('POST', '/groups/x/availability')).toBe(3500);
    expect(paceFor('POST', '/groups/join')).toBe(13000);
    expect(paceFor('DELETE', '/auth/me')).toBe(21000);
    expect(paceFor('POST', '/groups/x/events')).toBe(6500);
    expect(paceFor('GET', '/groups')).toBe(700);
  });

  it('interpreta Retry-After', () => {
    expect(retryAfterMs('2')).toBe(2000);
    expect(retryAfterMs(null)).toBe(60000);
    expect(retryAfterMs('abc')).toBe(60000);
  });
});

describe('clientes de Supabase', () => {
  it('crea el usuario confirmado, en español y con la service key', async () => {
    const clock = fakeClock();
    const server = scripted([json(200, { id: 'u1', email: 'demo-marta@quedamos.alvarotc.com' })]);
    const request = createRequester({ fetch: server.fetch, sleep: clock.sleep, now: clock.now });
    const admin = createAdminClient(request, 'https://fake.supabase.co', 'fake-service');
    const user = await admin.createUser(
      { key: 'marta', name: 'Marta', email: 'demo-marta@quedamos.alvarotc.com', avatarEmoji: '🌻' },
      'pw',
    );
    expect(user.id).toBe('u1');
    expect(server.calls[0]?.url).toBe('https://fake.supabase.co/auth/v1/admin/users');
    expect(headersOf(server.calls[0])).toMatchObject({ apikey: 'fake-service', authorization: 'Bearer fake-service' });
    expect(JSON.parse(String(server.calls[0]?.init?.body))).toEqual({
      email: 'demo-marta@quedamos.alvarotc.com',
      password: 'pw',
      email_confirm: true,
      user_metadata: { name: 'Marta', avatarEmoji: '🌻', language: 'es' },
    });
  });

  it('hace login por contraseña con la clave anónima', async () => {
    const clock = fakeClock();
    const server = scripted([json(200, { access_token: 'jwt-1' })]);
    const request = createRequester({ fetch: server.fetch, sleep: clock.sleep, now: clock.now });
    const token = await login(request, 'https://fake.supabase.co', 'fake-anon', 'a@b.c', 'pw');
    expect(token).toBe('jwt-1');
    expect(server.calls[0]?.url).toBe('https://fake.supabase.co/auth/v1/token?grant_type=password');
    expect(headersOf(server.calls[0]).apikey).toBe('fake-anon');
  });
});
