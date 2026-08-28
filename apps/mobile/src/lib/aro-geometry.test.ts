import { describe, it, expect } from 'vitest';
import { aroArc, aroStrokeWidth, slotCenter } from './aro-geometry';

describe('aroArc (convenio spec §5.3)', () => {
  it('n=6 r=16: dash ≈9.5 y arco centrado en su hueco', () => {
    const { dasharray, rotate } = aroArc(6, 0, 16);
    const [dash] = dasharray.split(' ').map(Number);
    expect(dash).toBeCloseTo(9.46, 1);
    // centro del arco en -90° (slot 0, arriba): rotate = -90 - arco/2 en grados
    expect(rotate).toBeCloseTo(-106.9, 0);
  });
  it('los slots están fijos: el slot i rota i*(360/n) más', () => {
    const a0 = aroArc(6, 0, 16).rotate;
    const a3 = aroArc(6, 3, 16).rotate;
    expect(a3 - a0).toBeCloseTo(180, 5);
  });
  it('n=12: arcos más finos pero mismos centros', () => {
    const { rotate } = aroArc(12, 0, 16);
    expect(rotate).toBeLessThan(-90);
    expect(aroArc(12, 6, 16).rotate - rotate).toBeCloseTo(180, 5);
  });
  it('short (apagado): arco corto, sigue centrado en su hueco', () => {
    const full = aroArc(6, 2, 16);
    const short = aroArc(6, 2, 16, { short: true });
    const dashFull = Number(full.dasharray.split(' ')[0]);
    const dashShort = Number(short.dasharray.split(' ')[0]);
    expect(dashShort).toBeLessThan(dashFull);
    const center = (r: number, d: number, C: number) => r + (d / C) * 180;
    const C = 2 * Math.PI * 16;
    expect(center(short.rotate, dashShort, C)).toBeCloseTo(center(full.rotate, dashFull, C), 1);
  });
});

describe('aroStrokeWidth', () => {
  it('degrada con el tamaño del grupo (tablero AroEscala)', () => {
    expect(aroStrokeWidth(6, 16)).toBe(3.5);
    expect(aroStrokeWidth(12, 16)).toBe(2.8);
    expect(aroStrokeWidth(20, 16)).toBe(2.2);
  });
});

describe('slotCenter', () => {
  it('slot 0 arriba, slot 1 a 60° en r dado', () => {
    const c0 = slotCenter(6, 0, 66);
    expect(c0.x).toBeCloseTo(0, 5);
    expect(c0.y).toBeCloseTo(-66, 5);
    const c1 = slotCenter(6, 1, 66);
    expect(c1.x).toBeCloseTo(66 * Math.sin(Math.PI / 3), 3);
    expect(c1.y).toBeCloseTo(-66 * Math.cos(Math.PI / 3), 3);
  });
});
