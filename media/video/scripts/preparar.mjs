import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { comprobarPng } from './png.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
export const LANGS = ['es', 'en'];
export const SLOTS = ['shot-01', 'shot-02', 'shot-03', 'shot-04', 'shot-05', 'shot-06', 'cover'];
export const MEDIDAS = { movil: { ancho: 1080, alto: 2340 }, escritorio: { ancho: 1600, alto: 1000 } };

// shot-01-es.png o shot-01-calendario-es.png; cover-es.png exacto (nunca cover-mobile-es.png).
const patron = (slot, lang) =>
  slot === 'cover' ? new RegExp(`^cover-${lang}\\.png$`) : new RegExp(`^${slot}(?:-[a-z0-9]+)?-${lang}\\.png$`);

/** Asigna a cada slot y idioma el fichero de origen. Devuelve { copias: [{ origen, destino, slot }], faltan: [] }. */
export const mapear = (nombres) => {
  const copias = [];
  const faltan = [];
  for (const lang of LANGS) {
    for (const slot of SLOTS) {
      const candidatos = nombres.filter((n) => patron(slot, lang).test(n)).sort();
      if (candidatos.length === 0) faltan.push(`${slot}-${lang}.png`);
      else if (candidatos.length > 1) faltan.push(`${slot}-${lang}.png (ambiguo: ${candidatos.join(', ')})`);
      else copias.push({ origen: candidatos[0], destino: `shots/${lang}/${slot}.png`, slot });
    }
  }
  return { copias, faltan };
};

export const preparar = (origen, publico) => {
  let nombres = [];
  try {
    nombres = readdirSync(origen);
  } catch {
    nombres = [];
  }
  const { copias, faltan } = mapear(nombres);
  const errores = faltan.map((f) => `falta ${join(origen, f)}`);
  for (const c of copias) {
    const medida = c.slot === 'cover' ? MEDIDAS.escritorio : MEDIDAS.movil;
    for (const e of comprobarPng(readFileSync(join(origen, c.origen)), medida)) errores.push(`${join(origen, c.origen)}: ${e}`);
  }
  if (errores.length > 0) return errores;
  rmSync(join(publico, 'shots'), { recursive: true, force: true });
  for (const c of copias) {
    mkdirSync(dirname(join(publico, c.destino)), { recursive: true });
    copyFileSync(join(origen, c.origen), join(publico, c.destino));
  }
  return [];
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const origen = resolve(process.argv[2] ?? join(raiz, '..', 'out', 'video-src'));
  const errores = preparar(origen, join(raiz, 'public'));
  if (errores.length > 0) {
    process.stderr.write(`Capturas del vídeo incompletas; el vídeo no sale con huecos:\n${errores.join('\n')}\n`);
    process.exit(1);
  }
  process.stdout.write(`${SLOTS.length * LANGS.length} capturas copiadas desde ${origen} a public/shots/\n`);
}
