import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  RODAJE_STATES,
  emptyTaps,
  isRodajeEvent,
  missingTaps,
  normalizeBox,
  parseRodajeArgs,
  rodajeOut,
  rodajeState,
} from '../src/rodaje-plan.ts';
import { DEMO_ACCOUNTS, demoEmail, readDemoPasswords } from '../src/env.ts';

const VP = { width: 360, height: 780 };

test('los estados siguen el guion y no se repiten', () => {
  const ids = RODAJE_STATES.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(ids, [
    'h-cal',
    'm-cal',
    'm-hoja-vacia',
    'm-hoja-llena',
    'm-cal-creada',
    'h-mazo',
    'h-voy',
    'h-plan-2',
    'h-plan-3',
    'h-plan-4',
    'h-plan-leo',
    'm-plan-pendiente',
    'm-plan-confirmada',
    'h-plan-confirmada',
  ]);
});

test('cada toque se mide en el estado anterior a la acción y en el móvil de quien la hace', () => {
  const taps = RODAJE_STATES.filter((s) => s.tap).map((s) => [s.id, s.tap, s.who]);
  assert.deepEqual(taps, [
    ['m-cal', 'quedamos', 'marta'],
    ['m-hoja-vacia', 'titulo', 'marta'],
    ['m-hoja-llena', 'crear', 'marta'],
    ['h-mazo', 'voy', 'hugo'],
    ['m-plan-pendiente', 'confirmar', 'marta'],
  ]);
  assert.ok(RODAJE_STATES.every((s) => s.id.startsWith(s.who === 'marta' ? 'm-' : 'h-')));
});

test('rodajeState y rodajeOut', () => {
  assert.equal(rodajeState('h-voy').who, 'hugo');
  assert.throws(() => rodajeState('nada'), /desconocido/);
  assert.equal(rodajeOut('en', 'h-mazo'), 'rodaje/en/h-mazo.png');
});

test('normalizeBox pasa de px a 0..1 y redondea', () => {
  assert.deepEqual(normalizeBox({ x: 36, y: 78, width: 180, height: 39 }, VP), { x: 0.1, y: 0.1, w: 0.5, h: 0.05 });
  const b = normalizeBox({ x: 10, y: 10, width: 100, height: 100 }, VP);
  assert.equal(b.x, 0.0278);
  assert.equal(b.h, 0.1282);
});

test('normalizeBox recorta lo que se sale y rechaza cajas fuera o vacías', () => {
  assert.deepEqual(normalizeBox({ x: -36, y: 702, width: 72, height: 156 }, VP), { x: 0, y: 0.9, w: 0.1, h: 0.1 });
  assert.throws(() => normalizeBox({ x: 400, y: 10, width: 20, height: 20 }, VP), /fuera/);
  assert.throws(() => normalizeBox({ x: 10, y: 10, width: 0, height: 20 }, VP), /fuera/);
  assert.throws(() => normalizeBox({ x: Number.NaN, y: 0, width: 1, height: 1 }, VP), /no válidos/);
  assert.throws(() => normalizeBox({ x: 0, y: 0, width: 1, height: 1 }, { width: 0, height: 780 }), /no válidos/);
});

test('missingTaps lista los toques sin medir por idioma', () => {
  const taps = emptyTaps();
  assert.equal(missingTaps(taps, ['es', 'en']).length, 10);
  for (const lang of ['es', 'en'] as const) {
    for (const id of ['quedamos', 'titulo', 'crear', 'voy', 'confirmar'] as const) {
      taps[lang][id] = { x: 0, y: 0, w: 1, h: 1 };
    }
  }
  delete taps.en.voy;
  assert.deepEqual(missingTaps(taps, ['es', 'en']), ['en.voy']);
});

test('parseRodajeArgs solo acepta --keep', () => {
  assert.deepEqual(parseRodajeArgs([]), { keep: false });
  assert.deepEqual(parseRodajeArgs(['--keep']), { keep: true });
  assert.throws(() => parseRodajeArgs(['--only', 'x']), /Argumento desconocido/);
});

test('isRodajeEvent solo casa la cena del 2 de octubre creada por Marta', () => {
  const base = { title: 'Cena del viernes', date: '2026-10-02T00:00:00.000Z', createdById: 'm' };
  assert.equal(isRodajeEvent(base, 'm'), true);
  assert.equal(isRodajeEvent({ ...base, createdById: undefined, createdBy: { id: 'm' } }, 'm'), true);
  assert.equal(isRodajeEvent({ ...base, createdById: 'h' }, 'm'), false);
  assert.equal(isRodajeEvent({ ...base, date: '2026-10-03' }, 'm'), false);
  assert.equal(isRodajeEvent({ ...base, title: 'Cena' }, 'm'), false);
});

test('cuentas demo: correos y contraseñas sin filtrar valores', () => {
  assert.deepEqual([...DEMO_ACCOUNTS], ['marta', 'hugo', 'noa', 'leo', 'julia']);
  assert.equal(demoEmail('noa'), 'demo-noa@quedamos.alvarotc.com');
  assert.throws(
    () => readDemoPasswords({ DEMO_PASSWORD_MARTA: 'secreto', DEMO_PASSWORD_HUGO: 'x' }),
    (error: unknown) =>
      error instanceof Error &&
      /DEMO_PASSWORD_NOA, DEMO_PASSWORD_LEO, DEMO_PASSWORD_JULIA/.test(error.message) &&
      !error.message.includes('secreto'),
  );
  const all = Object.fromEntries(DEMO_ACCOUNTS.map((a) => [`DEMO_PASSWORD_${a.toUpperCase()}`, `p-${a}`]));
  assert.equal(readDemoPasswords(all).julia, 'p-julia');
});
