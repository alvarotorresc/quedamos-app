// Lógica pura del rodaje (sin red ni navegador): estados en orden de guion, toques y argumentos.
import type { Lang } from './catalog.ts';
import type { DemoAccount } from './env.ts';

/** La quedada que se rueda. Mismo título en los dos idiomas. */
export const RODAJE_EVENT = { title: 'Cena del viernes', date: '2026-10-02' } as const;

export type TapId = 'quedamos' | 'titulo' | 'crear' | 'voy' | 'confirmar';

export interface RodajeState {
  id: string;
  /** Quién sale en la captura. */
  who: Extract<DemoAccount, 'marta' | 'hugo'>;
  /** Toque que se mide sobre este mismo estado (antes de pulsarlo). */
  tap?: TapId;
}

/** En el orden del guion: cada estado se captura en es y en antes de la acción siguiente. */
export const RODAJE_STATES: readonly RodajeState[] = [
  { id: 'h-cal', who: 'hugo' },
  { id: 'm-cal', who: 'marta', tap: 'quedamos' },
  { id: 'm-hoja-vacia', who: 'marta', tap: 'titulo' },
  { id: 'm-hoja-llena', who: 'marta', tap: 'crear' },
  { id: 'm-cal-creada', who: 'marta' },
  { id: 'h-mazo', who: 'hugo', tap: 'voy' },
  { id: 'h-voy', who: 'hugo' },
  { id: 'h-plan-2', who: 'hugo' },
  { id: 'h-plan-3', who: 'hugo' },
  { id: 'h-plan-4', who: 'hugo' },
  { id: 'h-plan-leo', who: 'hugo' },
  { id: 'm-plan-pendiente', who: 'marta', tap: 'confirmar' },
  { id: 'm-plan-confirmada', who: 'marta' },
  { id: 'h-plan-confirmada', who: 'hugo' },
];

export function rodajeState(id: string): RodajeState {
  const state = RODAJE_STATES.find((s) => s.id === id);
  if (!state) throw new Error(`Estado de rodaje desconocido: ${id}`);
  return state;
}

/** Relativo a media/out, como `Shot.out`. */
export function rodajeOut(lang: Lang, id: string): string {
  return `rodaje/${lang}/${id}.png`;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const round4 = (n: number): number => Math.round(n * 10_000) / 10_000;
const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

/**
 * Caja de Playwright (px CSS del viewport) a 0..1 respecto a la pantalla. Lo que se sale
 * de la pantalla se recorta; una caja fuera del todo o sin área es un error, no un toque.
 */
export function normalizeBox(
  box: { x: number; y: number; width: number; height: number },
  viewport: { width: number; height: number },
): Box {
  const values = [box.x, box.y, box.width, box.height, viewport.width, viewport.height];
  if (!values.every(Number.isFinite) || viewport.width <= 0 || viewport.height <= 0) {
    throw new Error('Caja o viewport no válidos');
  }
  const x0 = clamp01(box.x / viewport.width);
  const y0 = clamp01(box.y / viewport.height);
  const x1 = clamp01((box.x + box.width) / viewport.width);
  const y1 = clamp01((box.y + box.height) / viewport.height);
  if (x1 - x0 <= 0 || y1 - y0 <= 0) throw new Error('La caja del toque queda fuera de la pantalla');
  return { x: round4(x0), y: round4(y0), w: round4(x1 - x0), h: round4(y1 - y0) };
}

export type Taps = Record<Lang, Partial<Record<TapId, Box>>>;

export function emptyTaps(): Taps {
  return { es: {}, en: {} };
}

/** Faltan toques si algún estado con `tap` no se midió en algún idioma. */
export function missingTaps(taps: Taps, langs: readonly Lang[]): string[] {
  const missing: string[] = [];
  for (const lang of langs) {
    for (const state of RODAJE_STATES) {
      if (state.tap && !taps[lang][state.tap]) missing.push(`${lang}.${state.tap}`);
    }
  }
  return missing;
}

export interface RodajeArgs {
  keep: boolean;
}

export function parseRodajeArgs(argv: readonly string[]): RodajeArgs {
  let keep = false;
  for (const arg of argv) {
    if (arg === '--keep') keep = true;
    else throw new Error(`Argumento desconocido: ${arg} (solo se admite --keep)`);
  }
  return { keep };
}

/** Qué quedadas borra la limpieza: solo la del rodaje, y solo si la creó Marta. */
export function isRodajeEvent(
  event: { title: string; date: string; createdById?: string; createdBy?: { id: string } },
  martaId: string,
): boolean {
  const creator = event.createdById ?? event.createdBy?.id;
  return event.title === RODAJE_EVENT.title && event.date.slice(0, 10) === RODAJE_EVENT.date && creator === martaId;
}
