import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { comprobarPng } from './png.mjs';

// Salidas en media/out/ (hermana de media/video/): web/promo-{lang}.png y store/feature-graphic-{lang}.png.
// Uso: [RODAJE=CARPETA_RODAJE] npm run stills [-- CARPETA_CAPTURAS]
//      CARPETA_CAPTURAS: capturas de los stills (por defecto ../out/video-src).
//      RODAJE: estados y taps.json del vídeo (por defecto ../out/rodaje).
// Además, stills del vídeo en out/comprobacion/ (uno por escena y los momentos de transición) para
// revisarlo sin renderizarlo.
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const MEDIA_OUT = join(raiz, '..', 'out');
// Un frame asentado por escena y los momentos delicados: hoja a medio subir, título a medio escribir,
// pulsos en su pico, aviso, mazo entrando y etiqueta de Leo.
const FRAMES_ESCENA = [12, 37, 85, 170, 201, 207, 266, 300, 336, 342, 380, 420, 466, 498, 560, 610, 720, 790, 806, 850, 960, 1005];

const ejecutar = (cmd, args) => execFileSync(cmd, args, { cwd: raiz, stdio: 'inherit' });
const still = (comp, salida, props, frame) =>
  ejecutar('npx', ['remotion', 'still', 'out/bundle', comp, salida, ...(props ? [`--props=${JSON.stringify(props)}`] : []), ...(frame === undefined ? [] : [`--frame=${frame}`])]);
const aRgb = (entrada, salida) => ejecutar('ffmpeg', ['-y', '-loglevel', 'error', '-i', entrada, '-pix_fmt', 'rgb24', salida]);

ejecutar('node', ['scripts/preparar.mjs', ...process.argv.slice(2)]);
for (const d of ['out/tmp', 'out/comprobacion']) mkdirSync(join(raiz, d), { recursive: true });
for (const d of ['web', 'store']) mkdirSync(join(MEDIA_OUT, d), { recursive: true });
ejecutar('npx', ['remotion', 'bundle', 'src/index.tsx', '--out-dir', 'out/bundle']);

const errores = [];
const validar = (ruta, regla) => {
  for (const e of comprobarPng(readFileSync(ruta), regla)) errores.push(`${ruta}: ${e}`);
};

for (const lang of ['es', 'en']) {
  FRAMES_ESCENA.forEach((frame) => {
    const ruta = `out/comprobacion/${lang}-frame-${String(frame).padStart(4, '0')}.png`;
    still(`QuedamosPromo-${lang}`, ruta, undefined, frame);
    validar(join(raiz, ruta), { ancho: 1920, alto: 1080 });
  });
  still('Promo', `out/tmp/promo-${lang}.png`, { lang });
  aRgb(join(raiz, `out/tmp/promo-${lang}.png`), join(MEDIA_OUT, 'web', `promo-${lang}.png`));
  validar(join(MEDIA_OUT, 'web', `promo-${lang}.png`), { ancho: 1920, alto: 1080, sinAlfa: true });
  still('FeatureGraphic', `out/tmp/fg-${lang}.png`, { lang });
  aRgb(join(raiz, `out/tmp/fg-${lang}.png`), join(MEDIA_OUT, 'store', `feature-graphic-${lang}.png`));
  validar(join(MEDIA_OUT, 'store', `feature-graphic-${lang}.png`), { ancho: 1024, alto: 500, sinAlfa: true });
}

if (errores.length > 0) {
  process.stderr.write(`${errores.join('\n')}\n`);
  process.exit(1);
}
process.stdout.write(`stills válidos en ${MEDIA_OUT}/{web,store} y out/comprobacion/\n`);
