import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VIEWPORTS, buildCatalog, buildLabels, selectShots } from '../src/catalog.ts';

const catalog = buildCatalog();

test('28 capturas con id único', () => {
  assert.equal(catalog.length, 28);
  assert.equal(new Set(catalog.map((s) => s.id)).size, 28);
});

test('juego web: los nombres exactos de la spec', () => {
  const web = catalog.filter((s) => s.out.startsWith('web/')).map((s) => s.out).sort();
  const expected = [
    'cover', 'cover-mobile', 'shot-01-calendario', 'shot-02-proponer', 'shot-03-respuestas',
    'shot-04-quedada', 'shot-05-grupo', 'shot-06-perfil',
  ].flatMap((k) => [`web/${k}-es.png`, `web/${k}-en.png`]).sort();
  assert.deepEqual(web, expected);
});

test('temas de la galería alternan como en la spec', () => {
  const themeOf = (key: string) => catalog.find((s) => s.out === `web/${key}-es.png`)?.theme;
  assert.equal(themeOf('cover'), 'dark');
  assert.equal(themeOf('cover-mobile'), 'dark');
  assert.deepEqual(
    ['shot-01-calendario', 'shot-02-proponer', 'shot-03-respuestas', 'shot-04-quedada', 'shot-05-grupo', 'shot-06-perfil'].map(themeOf),
    ['dark', 'light', 'dark', 'light', 'dark', 'light'],
  );
});

test('video-src: las seis pantallas en oscuro, móvil y ambos idiomas', () => {
  const video = catalog.filter((s) => s.out.startsWith('video-src/'));
  assert.equal(video.length, 12);
  assert.ok(video.every((s) => s.theme === 'dark' && s.device === 'mobile'));
  assert.ok(video.some((s) => s.out === 'video-src/shot-02-proponer-en.png'));
});

test('medidas: portada de escritorio 1600×1000; el resto 1080×2340 y cuadra con el viewport', () => {
  for (const s of catalog) {
    const vp = VIEWPORTS[s.device];
    assert.equal(vp.width * vp.deviceScaleFactor, s.size.width, s.id);
    assert.equal(vp.height * vp.deviceScaleFactor, s.size.height, s.id);
  }
  assert.deepEqual(catalog.find((s) => s.id === 'web/cover-es')?.size, { width: 1600, height: 1000 });
  assert.deepEqual(catalog.find((s) => s.id === 'web/shot-05-grupo-en')?.size, { width: 1080, height: 2340 });
});

test('selectShots: todo, uno, o error con la lista de ids', () => {
  assert.equal(selectShots(catalog, null).length, 28);
  assert.deepEqual(selectShots(catalog, 'web/shot-02-proponer-en').map((s) => s.id), ['web/shot-02-proponer-en']);
  assert.throws(() => selectShots(catalog, 'nope'), /nope[\s\S]*web\/cover-es/);
});

test('labels: alt y caption no vacíos en es y en, también para el icono', () => {
  const labels = buildLabels();
  assert.equal(Object.keys(labels).length, 9);
  assert.equal(labels['shot-03-respuestas']?.files.en, 'shot-03-respuestas-en.png');
  assert.equal(labels.icon?.files.es, 'icon.png');
  for (const [key, l] of Object.entries(labels)) {
    for (const lang of ['es', 'en'] as const) {
      assert.ok(l.alt[lang].length > 0 && l.caption[lang].length > 0, `${key}.${lang}`);
    }
  }
});