import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { comprobarPng } from './png.mjs';

// Salidas en media/out/ (hermana de media/video/): web/promo-{lang}.png y store/feature-graphic-{lang}.png.
// Uso: npm run stills [-- CARPETA_CAPTURAS]  (por defecto ../out/video-src)
// Además un still por escena y composición en out/comprobacion/ para revisar el vídeo sin renderizarlo.
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const MEDIA_OUT = join(raiz, '..', 'out');
const FRAMES_ESCENA = [75, 195, 345, 480, 615, 795]; // desde + 75 de cada escena (desde + 75 frames = 2,5 s): todo ya ha entrado

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
  FRAMES_ESCENA.forEach((frame, i) => {
    const ruta = `out/comprobacion/${lang}-escena-${i + 1}.png`;
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
