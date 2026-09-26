import { describe, expect, it } from 'vitest';
import { ESTADOS as ESTADOS_PREPARAR, TAPS as TAPS_PREPARAR } from '../scripts/preparar.mjs';
import {
  DURACION_ESCRITURA,
  ESTADOS,
  FRAME_TAP,
  NIVELES,
  PASOS,
  QUIEN_TOCA,
  REACCION,
  TAPS,
  duracionEfecto,
  nivelEn,
  pasoEn,
  type Tap,
} from '../src/guion';
import { FPS, TRANSICION, escena } from '../src/timing';

const ESCENA_TAP: Record<Tap, 3 | 4 | 6> = { quedamos: 3, titulo: 3, crear: 3, voy: 4, confirmar: 6 };

describe('guion', () => {
  it('preparar y el vídeo esperan los mismos estados y toques', () => {
    expect([...ESTADOS_PREPARAR]).toEqual([...ESTADOS]);
    expect([...TAPS_PREPARAR]).toEqual([...TAPS]);
  });

  it.each(TAPS)('%s cae dentro de su escena, lejos de las transiciones de entrada y salida', (tap) => {
    const e = escena(ESCENA_TAP[tap]);
    expect(FRAME_TAP[tap]).toBeGreaterThanOrEqual(e.desde + TRANSICION);
    expect(FRAME_TAP[tap] + REACCION + TRANSICION).toBeLessThanOrEqual(e.desde + e.duracion - TRANSICION);
  });

  it('los toques de Marta son suyos y el de Hugo, suyo', () => {
    expect(TAPS.filter((t) => QUIEN_TOCA[t] === 'hugo')).toEqual(['voy']);
  });

  it('cada móvil usa estados del contrato, en orden y sin solapar efectos', () => {
    const usados = new Set<string>();
    for (const pasos of Object.values(PASOS)) {
      pasos.forEach((p, i) => {
        usados.add(p.estado);
        expect(ESTADOS).toContain(p.estado);
        if (i > 0) expect(p.desde).toBeGreaterThanOrEqual(pasos[i - 1].desde + duracionEfecto(pasos[i - 1].efecto));
      });
      expect(pasos[0].desde).toBe(escena(2).desde);
    }
    expect([...usados].sort()).toEqual([...ESTADOS].sort());
  });

  it('las transiciones duran 250-350 ms; solo la escritura es más larga (tecleo)', () => {
    for (const pasos of Object.values(PASOS)) {
      for (const p of pasos) {
        const ms = (duracionEfecto(p.efecto) * 1000) / FPS;
        if (p.efecto === 'corte') expect(ms).toBe(0);
        else if (p.efecto === 'escribe') expect(duracionEfecto(p.efecto)).toBe(DURACION_ESCRITURA);
        else {
          expect(ms).toBeGreaterThanOrEqual(250);
          expect(ms).toBeLessThanOrEqual(350);
        }
      }
    }
  });

  it('cada cambio de estado llega después de su toque', () => {
    const tras = (estado: string) => PASOS.marta.concat(PASOS.hugo).find((p) => p.estado === estado)?.desde ?? -1;
    expect(tras('m-hoja-vacia')).toBe(FRAME_TAP.quedamos + REACCION);
    expect(tras('m-hoja-llena')).toBe(FRAME_TAP.titulo + REACCION);
    expect(tras('m-cal-creada')).toBe(FRAME_TAP.crear + REACCION);
    expect(tras('h-voy')).toBe(FRAME_TAP.voy + REACCION);
    expect(tras('m-plan-confirmada')).toBe(FRAME_TAP.confirmar + REACCION);
    expect(tras('h-plan-confirmada')).toBe(FRAME_TAP.confirmar + REACCION);
  });

  it('pasoEn da el paso vigente, el anterior y el progreso del efecto', () => {
    const subida = PASOS.marta[1];
    expect(pasoEn(PASOS.marta, 0)).toMatchObject({ actual: PASOS.marta[0], previo: null, t: 1 });
    expect(pasoEn(PASOS.marta, subida.desde)).toMatchObject({ actual: subida, previo: PASOS.marta[0], t: 0 });
    expect(pasoEn(PASOS.marta, subida.desde + TRANSICION).t).toBe(1);
  });

  it('en cada escena del escenario actúa un móvil y el otro se atenúa', () => {
    const asentado = (n: 2 | 3 | 4 | 5 | 6) => escena(n).desde + escena(n).duracion / 2;
    const nivel = (m: 'marta' | 'hugo', f: number) => nivelEn(NIVELES[m], f).actual;
    for (const n of [2, 3] as const) expect([nivel('marta', asentado(n)), nivel('hugo', asentado(n))]).toEqual(['activo', 'atenuado']);
    for (const n of [4, 5] as const) expect([nivel('marta', asentado(n)), nivel('hugo', asentado(n))]).toEqual(['atenuado', 'activo']);
    expect(nivel('marta', FRAME_TAP.confirmar)).toBe('activo');
  });
});
