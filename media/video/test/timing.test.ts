import { describe, expect, it } from 'vitest';
import { DURACION_TOTAL, ESCENAS, FPS, TRANSICION, VOLUMEN_MUSICA, msAFrames, volumenMusica } from '../src/timing';

describe('timing', () => {
  it('las seis escenas suman 870 frames (29 s a 30 fps)', () => {
    expect(ESCENAS).toHaveLength(6);
    expect(ESCENAS.reduce((suma, e) => suma + e.duracion, 0)).toBe(DURACION_TOTAL);
    expect(DURACION_TOTAL).toBe(870);
    expect(DURACION_TOTAL / FPS).toBe(29);
  });

  it('cada escena empieza donde acaba la anterior y en el segundo del guion', () => {
    ESCENAS.forEach((e, i) => {
      const previa = ESCENAS[i - 1];
      expect(e.desde).toBe(previa ? previa.desde + previa.duracion : 0);
    });
    expect(ESCENAS.map((e) => e.desde / FPS)).toEqual([0, 4, 9, 14, 18, 24]);
  });

  it('las transiciones duran entre 300 y 400 ms', () => {
    expect(msAFrames(300)).toBe(9);
    expect(msAFrames(400)).toBe(12);
    expect(TRANSICION).toBeGreaterThanOrEqual(9);
    expect(TRANSICION).toBeLessThanOrEqual(12);
  });

  it('la música entra, se mantiene y acaba en silencio en el último frame', () => {
    expect(volumenMusica(0)).toBe(0);
    expect(volumenMusica(300)).toBeCloseTo(VOLUMEN_MUSICA);
    expect(volumenMusica(DURACION_TOTAL - FPS / 2)).toBeCloseTo(VOLUMEN_MUSICA / 2);
    expect(volumenMusica(DURACION_TOTAL)).toBe(0);
    for (let f = 0; f <= DURACION_TOTAL; f++) {
      expect(volumenMusica(f)).toBeGreaterThanOrEqual(0);
      expect(volumenMusica(f)).toBeLessThanOrEqual(VOLUMEN_MUSICA);
    }
  });
});
