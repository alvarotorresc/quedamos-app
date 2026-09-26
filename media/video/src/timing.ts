export const FPS = 30;
export const ANCHO = 1920;
export const ALTO = 1080;
export const DURACION_TOTAL = 870;

const s = (segundos: number) => segundos * FPS;

export const ESCENAS = [
  { n: 1, nombre: 'intro', desde: s(0), duracion: s(4) },
  { n: 2, nombre: 'calendario', desde: s(4), duracion: s(5) },
  { n: 3, nombre: 'proponer', desde: s(9), duracion: s(5) },
  { n: 4, nombre: 'fijada', desde: s(14), duracion: s(4) },
  { n: 5, nombre: 'navegacion', desde: s(18), duracion: s(6) },
  { n: 6, nombre: 'cierre', desde: s(24), duracion: s(5) },
] as const;

export type NumEscena = (typeof ESCENAS)[number]['n'];

export const escena = (n: NumEscena) => ESCENAS[n - 1];

export const msAFrames = (ms: number, fps: number = FPS) => Math.round((ms * fps) / 1000);

/** Transición estándar: fundidos y desplazamientos de 300 a 400 ms, sin rebotes. */
export const TRANSICION = msAFrames(350);

/** Volumen de la música: entra en 0,5 s y se apaga en el último segundo, acabando en 0 en el frame final. */
export const VOLUMEN_MUSICA = 0.6;
export const volumenMusica = (frame: number): number => {
  const entrada = Math.min(1, frame / msAFrames(500));
  const salida = Math.min(1, (DURACION_TOTAL - frame) / FPS);
  return Math.max(0, Math.min(entrada, salida)) * VOLUMEN_MUSICA;
};
