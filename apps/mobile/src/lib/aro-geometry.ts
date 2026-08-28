/**
 * Geometría del aro (spec §5.3).
 * Convenio obligatorio: con stroke-dasharray el trazo NACE en el ángulo dado,
 * así que cada arco se rota su ángulo de slot MENOS medio arco para quedar
 * centrado en su hueco. El error clásico (no restar medio arco) desplaza a
 * todos los miembros 21.6° y la misma persona cae en distinta hora del reloj
 * según la pantalla.
 */

const SMALL_RADIUS = 20;

export function aroStrokeWidth(n: number, radius: number): number {
  if (radius <= SMALL_RADIUS) return n <= 8 ? 3.5 : n <= 14 ? 2.8 : 2.2;
  return n <= 8 ? 9 : n <= 14 ? 7 : 5.5;
}

export function aroArc(
  n: number,
  index: number,
  radius: number,
  opts: { strokeWidth?: number; short?: boolean } = {},
): { dasharray: string; rotate: number } {
  const C = 2 * Math.PI * radius;
  const slot = C / n;
  const strokeWidth = opts.strokeWidth ?? aroStrokeWidth(n, radius);
  const small = radius <= SMALL_RADIUS;
  const gapVisible = Math.min(slot * 0.3, small ? 3.8 : 13);
  const full = Math.max(slot - strokeWidth - gapVisible, 1);
  const dash = opts.short ? Math.max(Math.min(5, full * 0.5), 1) : full;
  const slotAngle = -90 + index * (360 / n);
  const halfArcDeg = (dash / C) * 180;
  return {
    dasharray: `${dash.toFixed(2)} ${(C - dash).toFixed(2)}`,
    rotate: slotAngle - halfArcDeg,
  };
}

export function slotCenter(
  n: number,
  index: number,
  radius: number,
): { x: number; y: number } {
  const angle = ((-90 + index * (360 / n)) * Math.PI) / 180;
  return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
}
