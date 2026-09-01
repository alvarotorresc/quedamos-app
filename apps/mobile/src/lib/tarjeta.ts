/**
 * Renderer canvas de la tarjeta compartible (spec Fase 2, lienzo
 * `docs/superpowers/specs/lienzo-fase2/`). El layout es el de los artboards
 * aprobados `TarjetaCerrada`/`TarjetaCerradaNoche`/`TarjetaSellada` escalados
 * ×2 (540→1080): posiciones, tamaños, colores y copys son los del lienzo.
 *
 * Los arcos del aro reutilizan la misma matemática que el resto de la app
 * (`aro-geometry.ts`) vía `aroArcAngles`, así que un mismo grupo se ve en la
 * misma posición de reloj en el `<Aro>` de React y en esta tarjeta.
 */

import { aroArcAngles } from './aro-geometry';

export interface TarjetaCerradaOpts {
  weekdayLabel: string;
  dayNumber: string;
  titulo: string;
  subtitulo: string;
  memberColors: string[];
  theme: 'dia' | 'noche';
  /** Wordmark de marca, «¿Quedamos?» */
  marca: string;
}

export interface TarjetaSelladaOpts {
  titulo: string;
  plan: string;
  fechaHora: string;
  memberColors: string[];
  theme: 'dia' | 'noche';
  /** Wordmark de marca, «¿Quedamos?» */
  marca: string;
}

const CARD_SIZE = 1080;

// Aro central: r=120/sw=16 en el artboard (540) → ×2.
const CENTRAL_RADIUS = 240;
const CENTRAL_STROKE_WIDTH = 32;

// Mini aro de marca (header): r=16/sw=3.5 en el artboard → ×2.
const BRAND_RADIUS = 32;
const BRAND_STROKE_WIDTH = 7;
const BRAND_COLORS = ['#60A5FA', '#F59E0B', '#F472B6', '#34D399', '#A78BFA', '#FB7185'] as const;

// Check de TarjetaSellada: path del artboard `M -40 4 L -12 32 L 46 -30` ×2,
// relativo al centro del aro (mismo origen que sus círculos).
const CHECK_PATH: ReadonlyArray<readonly [number, number]> = [
  [-80, 8],
  [-24, 64],
  [92, -60],
];
const CHECK_STROKE_WIDTH = 28;

interface ThemePalette {
  bg: string;
  text: string;
  muted: string;
  border: string;
}

const THEME: Record<'dia' | 'noche', ThemePalette> = {
  dia: { bg: '#F5F1E8', text: '#33302A', muted: '#6E6858', border: '#E6DFD0' },
  noche: { bg: '#14120E', text: '#F2EFE7', muted: '#8F887A', border: 'rgba(242, 239, 231, 0.12)' },
};

// Family bare (sin fallback stack) para document.fonts.load: cargar la pila
// completa arriesga un parse-reject de la FontFaceSet API que no aporta nada
// (solo la familia real necesita precarga; el fallback nunca se "carga").
const DISPLAY_FAMILY = '"Bricolage Grotesque"';
const MONO_FAMILY = '"Geist Mono"';

// Con fallback, para ctx.font (ya cargadas o no, el canvas usa lo primero
// disponible en la pila).
const DISPLAY_FONT = `${DISPLAY_FAMILY}, -apple-system, "SF Pro Display", system-ui, sans-serif`;
const MONO_FONT = `${MONO_FAMILY}, ui-monospace, monospace`;

/**
 * Carga las fuentes usadas por la tarjeta antes de dibujar. Si `document.fonts`
 * no existe (jsdom en tests) o la carga falla, se sigue silenciosamente con el
 * stack de fallback ya incluido en cada `ctx.font`.
 */
async function loadCardFonts(): Promise<void> {
  const fontsApi = typeof document === 'undefined' ? undefined : document.fonts;
  if (!fontsApi || typeof fontsApi.load !== 'function') return;

  const specs = [
    `800 184px ${DISPLAY_FAMILY}`,
    `800 64px ${DISPLAY_FAMILY}`,
    `800 60px ${DISPLAY_FAMILY}`,
    `700 34px ${DISPLAY_FAMILY}`,
    `400 36px ${DISPLAY_FAMILY}`,
    `400 34px ${DISPLAY_FAMILY}`,
    `400 26px ${DISPLAY_FAMILY}`,
    `500 24px ${MONO_FAMILY}`,
    `500 26px ${MONO_FAMILY}`,
    `500 28px ${MONO_FAMILY}`,
  ];

  await Promise.allSettled(
    specs.map((spec) => {
      try {
        return fontsApi.load(spec);
      } catch {
        return Promise.resolve([]);
      }
    }),
  );
}

function createCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_SIZE;
  canvas.height = CARD_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('tarjeta: no se pudo obtener el contexto 2D del canvas');
  }
  return { canvas, ctx };
}

function toPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('tarjeta: toBlob no produjo ningún blob'));
        return;
      }
      resolve(blob);
    }, 'image/png');
  });
}

function drawBackground(ctx: CanvasRenderingContext2D, palette: ThemePalette): void {
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, CARD_SIZE, CARD_SIZE);
}

/** Dibuja un anillo de arcos (aroArcAngles) centrado en (cx, cy). */
function drawRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  strokeWidth: number,
  colors: readonly string[],
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.lineCap = 'round';
  ctx.lineWidth = strokeWidth;
  const n = colors.length;
  for (let i = 0; i < n; i += 1) {
    const { startRad, endRad } = aroArcAngles(n, i, radius, { strokeWidth });
    ctx.strokeStyle = colors[i];
    ctx.beginPath();
    ctx.arc(0, 0, radius, startRad, endRad);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBrand(ctx: CanvasRenderingContext2D, marca: string, palette: ThemePalette): void {
  const cx = 64 + BRAND_RADIUS;
  const cy = 52 + BRAND_RADIUS;
  drawRing(ctx, cx, cy, BRAND_RADIUS, BRAND_STROKE_WIDTH, BRAND_COLORS);

  ctx.fillStyle = palette.text;
  ctx.font = `700 34px ${DISPLAY_FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(marca, cx + BRAND_RADIUS + 20, cy);
}

/**
 * Pie de la tarjeta: filo de 2px + «Abrir en Quedamos» alineado a la derecha.
 * El artboard también muestra un placeholder `[enlace de invitación]` a la
 * izquierda, pero ninguna de las opts congeladas (`TarjetaCerradaOpts` /
 * `TarjetaSelladaOpts`) trae ese enlace — es `shareTarjeta` (Task 3) quien
 * conoce el `inviteUrl` y lo añade al texto/URL del share sheet, no al PNG.
 * Renderizar el texto entre corchetes tal cual lo mostraría a los
 * destinatarios reales, así que ese slot se deja vacío a propósito.
 */
function drawFooter(ctx: CanvasRenderingContext2D, palette: ThemePalette): void {
  const borderY = CARD_SIZE - 96;

  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, borderY);
  ctx.lineTo(CARD_SIZE, borderY);
  ctx.stroke();

  ctx.fillStyle = palette.muted;
  ctx.font = `400 26px ${DISPLAY_FONT}`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText('Abrir en Quedamos', CARD_SIZE - 64, borderY + 42);
}

export async function renderTarjetaCerrada(opts: TarjetaCerradaOpts): Promise<Blob> {
  await loadCardFonts();
  const palette = THEME[opts.theme];
  const { canvas, ctx } = createCanvas();

  drawBackground(ctx, palette);
  drawBrand(ctx, opts.marca, palette);
  drawFooter(ctx, palette);

  const cx = CARD_SIZE / 2;
  const cy = 470;
  drawRing(ctx, cx, cy, CENTRAL_RADIUS, CENTRAL_STROKE_WIDTH, opts.memberColors);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = palette.muted;
  ctx.font = `500 24px ${MONO_FONT}`;
  ctx.fillText(opts.weekdayLabel.toUpperCase(), cx, cy - 70);

  ctx.fillStyle = palette.text;
  ctx.font = `800 184px ${DISPLAY_FONT}`;
  ctx.fillText(opts.dayNumber, cx, cy + 20);

  ctx.fillStyle = palette.text;
  ctx.font = `800 60px ${DISPLAY_FONT}`;
  ctx.fillText(opts.titulo, cx, cy + CENTRAL_RADIUS + 100);

  ctx.fillStyle = palette.muted;
  ctx.font = `400 34px ${DISPLAY_FONT}`;
  ctx.fillText(opts.subtitulo, cx, cy + CENTRAL_RADIUS + 160);

  return toPngBlob(canvas);
}

export async function renderTarjetaSellada(opts: TarjetaSelladaOpts): Promise<Blob> {
  await loadCardFonts();
  const palette = THEME[opts.theme];
  const { canvas, ctx } = createCanvas();

  drawBackground(ctx, palette);
  drawBrand(ctx, opts.marca, palette);
  drawFooter(ctx, palette);

  const cx = CARD_SIZE / 2;
  const cy = 460;
  drawRing(ctx, cx, cy, CENTRAL_RADIUS, CENTRAL_STROKE_WIDTH, opts.memberColors);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = palette.text;
  ctx.lineWidth = CHECK_STROKE_WIDTH;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(CHECK_PATH[0][0], CHECK_PATH[0][1]);
  ctx.lineTo(CHECK_PATH[1][0], CHECK_PATH[1][1]);
  ctx.lineTo(CHECK_PATH[2][0], CHECK_PATH[2][1]);
  ctx.stroke();
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = palette.text;
  ctx.font = `800 64px ${DISPLAY_FONT}`;
  ctx.fillText(opts.titulo, cx, cy + CENTRAL_RADIUS + 100);

  ctx.fillStyle = palette.text;
  ctx.font = `400 36px ${DISPLAY_FONT}`;
  ctx.fillText(opts.plan, cx, cy + CENTRAL_RADIUS + 160);

  ctx.fillStyle = palette.muted;
  ctx.font = `500 28px ${MONO_FONT}`;
  ctx.fillText(opts.fechaHora, cx, cy + CENTRAL_RADIUS + 210);

  return toPngBlob(canvas);
}
