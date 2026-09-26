// Coreografía de las escenas 2 a 6 (docs/superpowers/specs/2026-09-26-video-flujo-design.md): qué
// captura del rodaje muestra cada móvil, cuándo cae cada toque y qué móvil actúa. Todo en frames
// globales del vídeo (30 fps). Sin React: se prueba en test/guion.test.ts.
import { TRANSICION, escena, msAFrames } from './timing';

export const ESTADOS = [
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
] as const;
export type Estado = (typeof ESTADOS)[number];

export const TAPS = ['quedamos', 'titulo', 'crear', 'voy', 'confirmar'] as const;
export type Tap = (typeof TAPS)[number];

/** Caja del elemento tocado, normalizada de 0 a 1 respecto a la pantalla del móvil. */
export type Caja = { x: number; y: number; w: number; h: number };
export type Cajas = Record<Tap, Caja>;
export type TapsRodaje = { es: Cajas; en: Cajas };

/** Cajas de reserva para el studio sin rodaje; el render real usa media/out/rodaje/taps.json. */
export const CAJAS_RESERVA: Cajas = {
  quedamos: { x: 0.56, y: 0.3, w: 0.34, h: 0.05 },
  titulo: { x: 0.06, y: 0.5, w: 0.88, h: 0.06 },
  crear: { x: 0.06, y: 0.86, w: 0.88, h: 0.06 },
  voy: { x: 0.52, y: 0.78, w: 0.4, h: 0.07 },
  confirmar: { x: 0.06, y: 0.84, w: 0.88, h: 0.06 },
};

export type Movil = 'marta' | 'hugo';

/**
 * Frames de los cinco toques. Caen en ataques de la música (Loyalty Freak Music, «Go to the Picnic»,
 * unos 140 bpm, un pulso cada ~12,9 frames), medidos con un detector de ataques sobre public/audio/musica.mp3.
 * Para moverlos basta con cambiar estos números: los cambios de estado cuelgan de ellos.
 */
export const FRAME_TAP: Record<Tap, number> = {
  quedamos: 289,
  titulo: 346,
  crear: 424,
  voy: 585,
  confirmar: 893,
};

export const QUIEN_TOCA: Record<Tap, Movil> = { quedamos: 'marta', titulo: 'marta', crear: 'marta', voy: 'hugo', confirmar: 'marta' };

/** Lo que tarda la app en reaccionar tras el toque, para que el pulso se vea antes del cambio. */
export const REACCION = 4;
/** La escritura de «Cena del viernes»: más larga que una transición porque es tecleo, no movimiento. */
export const DURACION_ESCRITURA = msAFrames(800);
export const DURACION_PULSO = msAFrames(450);

export type Efecto = 'corte' | 'fundido' | 'sube' | 'baja' | 'entra' | 'escribe';
export type Paso = { desde: number; estado: Estado; efecto: Efecto };

export const duracionEfecto = (efecto: Efecto): number =>
  efecto === 'corte' ? 0 : efecto === 'escribe' ? DURACION_ESCRITURA : TRANSICION;

const tras = (tap: Tap) => FRAME_TAP[tap] + REACCION;

/** Aviso «Nueva quedada» sobre el móvil de Hugo: cae, se queda y sube antes de que entre el mazo. */
export const AVISO = { cae: 494, sube: 542 } as const;
/** Etiqueta «Leo · No voy» junto al móvil de Hugo. */
export const ETIQUETA_LEO = { entra: 796, sale: escena(5).desde + escena(5).duracion - TRANSICION } as const;

export const PASOS: Record<Movil, Paso[]> = {
  marta: [
    { desde: escena(2).desde, estado: 'm-cal', efecto: 'corte' },
    { desde: tras('quedamos'), estado: 'm-hoja-vacia', efecto: 'sube' },
    { desde: tras('titulo'), estado: 'm-hoja-llena', efecto: 'escribe' },
    { desde: tras('crear'), estado: 'm-cal-creada', efecto: 'baja' },
    { desde: escena(6).desde + 4, estado: 'm-plan-pendiente', efecto: 'fundido' },
    { desde: tras('confirmar'), estado: 'm-plan-confirmada', efecto: 'fundido' },
  ],
  hugo: [
    { desde: escena(2).desde, estado: 'h-cal', efecto: 'corte' },
    { desde: 552, estado: 'h-mazo', efecto: 'entra' },
    { desde: tras('voy'), estado: 'h-voy', efecto: 'fundido' },
    { desde: 618, estado: 'h-plan-2', efecto: 'fundido' },
    { desde: 688, estado: 'h-plan-3', efecto: 'fundido' },
    { desde: 733, estado: 'h-plan-4', efecto: 'fundido' },
    { desde: 790, estado: 'h-plan-leo', efecto: 'fundido' },
    { desde: tras('confirmar'), estado: 'h-plan-confirmada', efecto: 'fundido' },
  ],
};

/** Paso vigente, el anterior y el progreso 0..1 del efecto de entrada del vigente (sin easing). */
export const pasoEn = (pasos: Paso[], frame: number): { actual: Paso; previo: Paso | null; t: number } => {
  let i = 0;
  while (i + 1 < pasos.length && pasos[i + 1].desde <= frame) i++;
  const actual = pasos[i];
  const d = duracionEfecto(actual.efecto);
  const t = i === 0 || d === 0 ? 1 : Math.min(1, Math.max(0, (frame - actual.desde) / d));
  return { actual, previo: i === 0 ? null : pasos[i - 1], t };
};

/**
 * Quién actúa: el activo se adelanta (×1,04, brillo pleno) y el otro se atenúa. En la escena 2 entran
 * los dos neutros y Marta se adelanta al acabar la entrada; al confirmar, Hugo vuelve a brillo pleno
 * porque pasa al mismo estado a la vez.
 */
export type Nivel = 'neutro' | 'activo' | 'atenuado';
export const ASPECTO: Record<Nivel, { escala: number; brillo: number }> = {
  neutro: { escala: 1, brillo: 1 },
  activo: { escala: 1.04, brillo: 1 },
  atenuado: { escala: 1, brillo: 0.55 },
};
export type CambioNivel = { desde: number; nivel: Nivel };

const ADELANTA_MARTA = escena(2).desde + 20;
export const NIVELES: Record<Movil, CambioNivel[]> = {
  marta: [
    { desde: escena(2).desde, nivel: 'neutro' },
    { desde: ADELANTA_MARTA, nivel: 'activo' },
    { desde: escena(4).desde, nivel: 'atenuado' },
    { desde: escena(6).desde, nivel: 'activo' },
  ],
  hugo: [
    { desde: escena(2).desde, nivel: 'neutro' },
    { desde: ADELANTA_MARTA, nivel: 'atenuado' },
    { desde: escena(4).desde, nivel: 'activo' },
    { desde: escena(6).desde, nivel: 'atenuado' },
    { desde: tras('confirmar'), nivel: 'neutro' },
  ],
};

/** Nivel vigente, el anterior y el progreso 0..1 (sin easing) del cambio, que dura una transición. */
export const nivelEn = (cambios: CambioNivel[], frame: number): { actual: Nivel; previo: Nivel; t: number } => {
  let i = 0;
  while (i + 1 < cambios.length && cambios[i + 1].desde <= frame) i++;
  const t = i === 0 ? 1 : Math.min(1, Math.max(0, (frame - cambios[i].desde) / TRANSICION));
  return { actual: cambios[i].nivel, previo: cambios[Math.max(0, i - 1)].nivel, t };
};
