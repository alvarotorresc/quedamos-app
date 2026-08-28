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

  it('radio grande (>20, rama GroupRing): degrada igual pero con trazos más gruesos', () => {
    expect(aroStrokeWidth(6, 66)).toBe(9);
    expect(aroStrokeWidth(12, 66)).toBe(7);
    expect(aroStrokeWidth(20, 66)).toBe(5.5);
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

describe('aroArc con radio grande (>20, cobertura GroupRing — deferred de Task 3)', () => {
  it('n=6 r=66 strokeWidth=5: gapVisible se satura en el cap de 13 (rama radio grande)', () => {
    const { dasharray, rotate } = aroArc(6, 0, 66, { strokeWidth: 5 });
    const [dash] = dasharray.split(' ').map(Number);
    const C = 2 * Math.PI * 66; // ≈ 414.69
    const slot = C / 6; // ≈ 69.115
    const gapVisible = Math.min(slot * 0.3, 13); // radio > 20 ⇒ cap 13 (no 3.8)
    expect(gapVisible).toBeCloseTo(13, 5);
    const expectedDash = slot - 5 - gapVisible; // ≈ 51.115
    expect(dash).toBeCloseTo(expectedDash, 1);
    expect(dash).toBeCloseTo(51.11, 1);
    const expectedHalfArcDeg = (expectedDash / C) * 180; // ≈ 22.19
    expect(rotate).toBeCloseTo(-90 - expectedHalfArcDeg, 1);
    expect(rotate).toBeCloseTo(-112.19, 1);
  });

  it('slotCenter y aroArc comparten el ángulo de slot (n=6, i=1): centro del arco == centro del slot', () => {
    const n = 6;
    const i = 1;
    const r = 66;
    const { dasharray, rotate } = aroArc(n, i, r, { strokeWidth: 5 });
    const [dash] = dasharray.split(' ').map(Number);
    const C = 2 * Math.PI * r;
    const halfArcDeg = (dash / C) * 180; // derivado del dasharray devuelto, no recalculado a mano
    const arcCenterAngle = rotate + halfArcDeg;

    const p = slotCenter(n, i, r);
    const slotAngle = (Math.atan2(p.y, p.x) * 180) / Math.PI;

    expect(slotAngle).toBeCloseTo(-30, 5);
    // dasharray se serializa con 2 decimales (toFixed), así que re-derivar halfArc
    // desde el string introduce un error de redondeo del orden de una milésima de grado.
    expect(arcCenterAngle).toBeCloseTo(slotAngle, 2);
  });
});
