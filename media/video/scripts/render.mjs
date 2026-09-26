import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Render final: capturas → música → tests → render maestro (CRF 18) → compresión web → verificación.
// Uso: npm run render            (es y en)
//      npm run render -- es      (solo un idioma)
//      RODAJE=/ruta npm run render  (rodaje del vídeo fuera de ../out/rodaje)
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const WEB = join(raiz, '..', 'out', 'web');
const langs = process.argv.slice(2).filter((a) => a === 'es' || a === 'en');

const ejecutar = (cmd, args) => execFileSync(cmd, args, { cwd: raiz, stdio: 'inherit' });

ejecutar('node', ['scripts/preparar.mjs']);
ejecutar('node', ['scripts/audio.mjs']);
ejecutar('npx', ['vitest', 'run']);
mkdirSync(join(raiz, 'out', 'master'), { recursive: true });
mkdirSync(WEB, { recursive: true });

for (const lang of langs.length > 0 ? langs : ['es', 'en']) {
  const maestro = join(raiz, 'out', 'master', `quedamos-promo-${lang}.mp4`);
  const final = join(WEB, `quedamos-promo-${lang}.mp4`);
  ejecutar('npx', ['remotion', 'render', 'src/index.tsx', `QuedamosPromo-${lang}`, maestro, '--codec=h264', '--crf=18', '--audio-codec=aac', '--enforce-audio-track']);
  // --enforce-audio-track garantiza pista AAC (silenciosa si faltara la música).
  ejecutar('ffmpeg', [
    '-y', '-loglevel', 'error', '-i', maestro, '-map', '0:v:0', '-map', '0:a:0',
    '-vf', 'scale=out_range=tv', '-c:v', 'libx264', '-preset', 'slow', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    '-c:a', 'aac', '-b:a', '96k', final,
  ]);
  ejecutar('bash', ['scripts/verificar-video.sh', final]);
}
