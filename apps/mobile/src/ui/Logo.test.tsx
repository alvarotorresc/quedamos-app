import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Logo } from './Logo';
import { aroArc } from '../lib/aro-geometry';

const EXPECTED_ROTATIONS = ['rotate(-110.55)', 'rotate(-50.55)', 'rotate(9.45)', 'rotate(129.45)', 'rotate(189.45)'];

describe('Logo', () => {
  it('pinta 5 arcos de miembro con el dasharray y el rotate exactos del aro (slots 0,1,2,4,5) + el punto del sexto color', () => {
    const { container } = render(<Logo />);
    const circles = container.querySelectorAll('circle');
    expect(circles).toHaveLength(6);
    const arcs = [...circles].slice(0, 5);
    arcs.forEach((c) => {
      expect(c.getAttribute('stroke-dasharray')).toBe('71.72 556.60');
    });
    // Pin the rotate() in DOM order: reordering MEMBER_SLOTS would swap which
    // color lands in which clock position without failing any other test.
    expect(arcs.map((c) => c.getAttribute('transform'))).toEqual(EXPECTED_ROTATIONS);
    const dot = circles[5];
    expect(dot.getAttribute('cx')).toBe('0');
    expect(dot.getAttribute('cy')).toBe('106');
    expect(dot.getAttribute('r')).toBe('13');
  });

  it("variant='color' (por defecto): arcos con la paleta multicolor y punto morado", () => {
    const { container } = render(<Logo variant="color" />);
    const circles = [...container.querySelectorAll('circle')];
    const arcStrokes = circles.slice(0, 5).map((c) => c.getAttribute('stroke'));
    expect(arcStrokes).toEqual(['#60A5FA', '#F59E0B', '#F472B6', '#34D399', '#FB7185']);
    expect(circles[5].getAttribute('fill')).toBe('#A78BFA');
  });

  it("variant='mono': arcos en currentColor y punto azul", () => {
    const { container } = render(<Logo variant="mono" />);
    const circles = [...container.querySelectorAll('circle')];
    circles.slice(0, 5).forEach((c) => {
      expect(c.getAttribute('stroke')).toBe('currentColor');
    });
    expect(circles[5].getAttribute('fill')).toBe('#60A5FA');
  });

  it('size por defecto 24 y className pasa al svg', () => {
    const { container } = render(<Logo className="custom" />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('24');
    expect(svg?.getAttribute('height')).toBe('24');
    expect(svg?.getAttribute('class')).toContain('custom');
  });

  it('size prop cambia el tamaño del svg', () => {
    const { container } = render(<Logo size={48} />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('48');
    expect(svg?.getAttribute('height')).toBe('48');
  });

  it('usa el viewBox exacto aprobado en el lienzo', () => {
    const { container } = render(<Logo />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('viewBox')).toBe('-120 -120 240 240');
  });
});

describe('geometría aprobada del lienzo (anclaje)', () => {
  it("aroArc(6, 0, 100, { strokeWidth: 20 }) === { dasharray: '71.72 556.60', rotate: -110.55 }", () => {
    const { dasharray, rotate } = aroArc(6, 0, 100, { strokeWidth: 20 });
    expect(dasharray).toBe('71.72 556.60');
    expect(rotate).toBeCloseTo(-110.55, 2);
  });
});
