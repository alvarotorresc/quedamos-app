import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
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

// Rodaje del vídeo (media/shots, comando rodaje): una captura por estado e idioma y las cajas de los toques.
// Tiene que coincidir con ESTADOS y TAPS de src/guion.ts (lo comprueba test/scripts.test.ts).
export const ESTADOS = [
  'h-cal', 'm-cal', 'm-hoja-vacia', 'm-hoja-llena', 'm-cal-creada', 'h-mazo', 'h-voy',
  'h-plan-2', 'h-plan-3', 'h-plan-4', 'h-plan-leo', 'm-plan-pendiente', 'm-plan-confirmada', 'h-plan-confirmada',
];
export const TAPS = ['quedamos', 'titulo', 'crear', 'voy', 'confirmar'];

/** Errores de taps.json: cada idioma con las cinco cajas {x, y, w, h} dentro de la pantalla (0..1). */
export const comprobarTaps = (datos) => {
  const errores = [];
  for (const lang of LANGS) {
    const cajas = datos?.[lang];
    if (typeof cajas !== 'object' || cajas === null) {
      errores.push(`falta el idioma ${lang}`);
      continue;
    }
    for (const tap of TAPS) {
      const c = cajas[tap];
      const nums = c && ['x', 'y', 'w', 'h'].every((k) => typeof c[k] === 'number' && Number.isFinite(c[k]));
      if (!nums) errores.push(`falta el toque ${lang}.${tap} (se espera {x, y, w, h})`);
      else if (c.x < 0 || c.y < 0 || c.w <= 0 || c.h <= 0 || c.x + c.w > 1 || c.y + c.h > 1)
        errores.push(`${lang}.${tap} se sale de la pantalla (valores normalizados de 0 a 1): ${JSON.stringify(c)}`);
    }
  }
  return errores;
};

/** Copia origen/{es,en}/<estado>.png y origen/taps.json a publico/rodaje/. Devuelve la lista de errores (vacía si todo va bien). */
export const prepararRodaje = (origen, publico) => {
  const errores = [];
  for (const lang of LANGS) {
    for (const estado of ESTADOS) {
      const ruta = join(origen, lang, `${estado}.png`);
      if (!existsSync(ruta)) errores.push(`falta el estado ${ruta}`);
      else for (const e of comprobarPng(readFileSync(ruta), MEDIDAS.movil)) errores.push(`${ruta}: ${e}`);
    }
  }
  const rutaTaps = join(origen, 'taps.json');
  let taps = null;
  if (!existsSync(rutaTaps)) errores.push(`falta ${rutaTaps}`);
  else {
    try {
      taps = JSON.parse(readFileSync(rutaTaps, 'utf8'));
      for (const e of comprobarTaps(taps)) errores.push(`${rutaTaps}: ${e}`);
    } catch (e) {
      errores.push(`${rutaTaps}: no es JSON válido (${e.message})`);
    }
  }
  if (errores.length > 0) return errores;
  rmSync(join(publico, 'rodaje'), { recursive: true, force: true });
  for (const lang of LANGS) {
    mkdirSync(join(publico, 'rodaje', lang), { recursive: true });
    for (const estado of ESTADOS) copyFileSync(join(origen, lang, `${estado}.png`), join(publico, 'rodaje', lang, `${estado}.png`));
  }
  const soloCajas = Object.fromEntries(LANGS.map((l) => [l, Object.fromEntries(TAPS.map((t) => [t, taps[l][t]]))]));
  writeFileSync(join(publico, 'rodaje', 'taps.json'), `${JSON.stringify(soloCajas, null, 2)}\n`);
  return [];
};

// Uso: node scripts/preparar.mjs [CARPETA_CAPTURAS]      (por defecto ../out/video-src, para los stills)
//      RODAJE=/ruta/al/rodaje node scripts/preparar.mjs  (por defecto ../out/rodaje, para el vídeo)
// La variable RODAJE pasa también por `npm run stills` y `npm run render`, que llaman a este script.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const origen = resolve(process.argv[2] ?? join(raiz, '..', 'out', 'video-src'));
  const rodaje = resolve(process.env.RODAJE || join(raiz, '..', 'out', 'rodaje'));
  const errores = preparar(origen, join(raiz, 'public'));
  const erroresRodaje = prepararRodaje(rodaje, join(raiz, 'public'));
  if (errores.length > 0) process.stderr.write(`Capturas de los stills incompletas; no salen con huecos:\n${errores.join('\n')}\n`);
  if (erroresRodaje.length > 0)
    process.stderr.write(`Rodaje del vídeo incompleto (genéralo con el comando rodaje de media/shots o indica otra carpeta con RODAJE=...):\n${erroresRodaje.join('\n')}\n`);
  if (errores.length + erroresRodaje.length > 0) process.exit(1);
  process.stdout.write(`${SLOTS.length * LANGS.length} capturas copiadas desde ${origen} a public/shots/\n`);
  process.stdout.write(`${ESTADOS.length * LANGS.length} estados y taps.json copiados desde ${rodaje} a public/rodaje/\n`);
}
