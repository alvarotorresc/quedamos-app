import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Cuadrilla } from './Cuadrilla';
import { MEMBER_COLORS } from '../../lib/constants';

describe('Cuadrilla', () => {
  it('pinta el titular y los 6 nombres ficticios en orden de color de miembro', () => {
    render(<Cuadrilla />);
    expect(screen.getByText('landing2.cuadrilla.title')).toBeInTheDocument();
    ['vera', 'hugo', 'noa', 'leo', 'iris', 'teo'].forEach((key) => {
      expect(screen.getByText(`landing2.cuadrilla.names.${key}`)).toBeInTheDocument();
    });
  });

  it('cada franja usa el color de miembro correspondiente (sin hex nuevos)', () => {
    const { container } = render(<Cuadrilla />);
    const stripes = container.querySelectorAll('.grid > div');
    expect(stripes).toHaveLength(6);
    stripes.forEach((stripe, i) => {
      expect((stripe as HTMLElement).style.backgroundColor).toBe(hexToRgb(MEMBER_COLORS[i]));
    });
  });
});

function hexToRgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgb(${r}, ${g}, ${b})`;
}
