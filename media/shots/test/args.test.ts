import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs } from '../src/args.ts';

test('sin argumentos: todo', () => {
  assert.deepEqual(parseArgs([]), { only: null });
});

test('--only con espacio o con =', () => {
  assert.deepEqual(parseArgs(['--only', 'web/cover-es']), { only: 'web/cover-es' });
  assert.deepEqual(parseArgs(['--only=icon']), { only: 'icon' });
});

test('errores: --only sin valor y argumentos desconocidos', () => {
  assert.throws(() => parseArgs(['--only']), /--only/);
  assert.throws(() => parseArgs(['--only', '--foo']), /--only/);
  assert.throws(() => parseArgs(['--only=']), /--only/);
  assert.throws(() => parseArgs(['--foo']), /--foo/);
});
