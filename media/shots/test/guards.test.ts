import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GuardError,
  assertNoSkeletons,
  assertPng,
  assertRoute,
  assertTheme,
  captureStable,
  readPngSize,
} from '../src/guards.ts';

function fakePng(width: number, height: number): Buffer {
  const buf = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
  buf.writeUInt32BE(13, 8);
  buf.write('IHDR', 12, 'ascii');
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

const isGuard = (guard: string) => (err: unknown) => err instanceof GuardError && err.guard === guard;

test('readPngSize lee ancho y alto del IHDR', () => {
  assert.deepEqual(readPngSize(fakePng(1080, 2340)), { width: 1080, height: 2340 });
});

test('readPngSize rechaza lo que no es PNG', () => {
  assert.throws(() => readPngSize(Buffer.from('esto no es un png, aunque sea largo')), isGuard('png'));
  assert.throws(() => readPngSize(fakePng(1, 1).subarray(0, 20)), isGuard('png'));
});

test('assertPng: vacío y dimensiones', () => {
  assert.throws(() => assertPng(Buffer.alloc(0), { width: 1, height: 1 }, 'x'), isGuard('no-vacio'));
  assert.throws(
    () => assertPng(fakePng(1080, 2339), { width: 1080, height: 2340 }, 'x'),
    (err: unknown) => isGuard('dimensiones')(err) && String(err).includes('1080×2339'),
  );
  assert.doesNotThrow(() => assertPng(fakePng(1600, 1000), { width: 1600, height: 1000 }, 'x'));
});

test('assertNoSkeletons y assertTheme', () => {
  assert.throws(() => assertNoSkeletons(2, 'x'), isGuard('sin-esqueleto'));
  assert.doesNotThrow(() => assertNoSkeletons(0, 'x'));
  assert.throws(() => assertTheme(true, 'dark', 'x'), isGuard('tema'));
  assert.doesNotThrow(() => assertTheme(true, 'light', 'x'));
});

test('assertRoute detecta que la app mandó a otra ruta (sesión caducada)', () => {
  assert.throws(() => assertRoute('/login', '/tabs/calendar', 'x'), isGuard('ruta'));
  assert.doesNotThrow(() => assertRoute('/tabs/plans', '/tabs/plans', 'x'));
});

function sequence(...bufs: Buffer[]): { shoot: () => Promise<Buffer>; calls: () => number } {
  let i = 0;
  return {
    shoot: async () => bufs[Math.min(i++, bufs.length - 1)] ?? Buffer.alloc(0),
    calls: () => i,
  };
}

test('captureStable devuelve en cuanto dos capturas seguidas coinciden', async () => {
  const a = Buffer.from('a');
  const b = Buffer.from('b');
  const s1 = sequence(a, a);
  assert.equal(await captureStable(s1.shoot, { label: 'x', pauseMs: 0 }), a);
  assert.equal(s1.calls(), 2);
  const s2 = sequence(a, b, b);
  assert.equal(await captureStable(s2.shoot, { label: 'x', pauseMs: 0 }), b);
  assert.equal(s2.calls(), 3);
});

test('captureStable se rinde tras maxAttempts', async () => {
  let n = 0;
  const shoot = async () => Buffer.from(String(n++));
  await assert.rejects(captureStable(shoot, { label: 'x', maxAttempts: 4, pauseMs: 0 }), isGuard('hash-estable'));
  assert.equal(n, 4);
});
