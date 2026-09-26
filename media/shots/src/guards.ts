import { createHash } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';

export interface PngSize {
  width: number;
  height: number;
}

export class GuardError extends Error {
  guard: string;
  constructor(guard: string, message: string) {
    super(message);
    this.name = 'GuardError';
    this.guard = guard;
  }
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Ancho y alto del chunk IHDR, que siempre va justo tras la firma (bytes 16-23). */
export function readPngSize(buf: Buffer): PngSize {
  if (buf.length < 24 || !buf.subarray(0, 8).equals(PNG_SIGNATURE) || buf.toString('ascii', 12, 16) !== 'IHDR') {
    throw new GuardError('png', 'No es un PNG válido o está truncado');
  }
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

export function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

export function assertPng(buf: Buffer, expected: PngSize, label: string): void {
  if (buf.length === 0) throw new GuardError('no-vacio', `${label}: la captura está vacía`);
  const { width, height } = readPngSize(buf);
  if (width !== expected.width || height !== expected.height) {
    throw new GuardError(
      'dimensiones',
      `${label}: mide ${width}×${height}, se esperaba ${expected.width}×${expected.height}`,
    );
  }
}

export function assertNoSkeletons(count: number, label: string): void {
  if (count > 0) throw new GuardError('sin-esqueleto', `${label}: quedan ${count} nodos .skeleton`);
}

export function assertTheme(isLight: boolean, theme: 'dark' | 'light', label: string): void {
  if (isLight !== (theme === 'light')) {
    throw new GuardError('tema', `${label}: se pidió ${theme} y <html> ${isLight ? 'sí' : 'no'} tiene .light`);
  }
}

export function assertRoute(actualPath: string, expectedPath: string, label: string): void {
  if (actualPath !== expectedPath) {
    throw new GuardError('ruta', `${label}: se esperaba ${expectedPath} y la app está en ${actualPath} (¿sesión caducada?)`);
  }
}

/** Dispara hasta que dos capturas seguidas tienen el mismo hash: detecta animaciones a medias. */
export async function captureStable(
  shoot: () => Promise<Buffer>,
  { label, maxAttempts = 4, pauseMs = 400 }: { label: string; maxAttempts?: number; pauseMs?: number },
): Promise<Buffer> {
  let previous = await shoot();
  for (let attempt = 2; attempt <= maxAttempts; attempt++) {
    if (pauseMs > 0) await sleep(pauseMs);
    const next = await shoot();
    if (sha256(next) === sha256(previous)) return next;
    previous = next;
  }
  throw new GuardError('hash-estable', `${label}: la pantalla sigue cambiando tras ${maxAttempts} capturas`);
}
