import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Cuadrilla } from './Cuadrilla';
import { MEMBER_COLORS } from '../../lib/constants';

let motionSafeValue = true;
vi.mock('../../lib/motion', () => ({
  spring: { gentle: {}, snappy: {}, bouncy: {} },
  useMotionSafe: () => motionSafeValue,
}));

// Local override of the global framer-motion mock (src/test/setup.ts): that one
// strips `initial` entirely, so a test asserting on it would pass identically
// whether or not the component actually gates the entrance behind
// useMotionSafe. Surface `initial` as a data attribute so the gate test
// discriminates the real branch (see 36c42f0 for the same fix on
// HeroPregunta/BandaAro).
vi.mock('framer-motion', async () => {
  const React = await import('react');
  const motionProxy = new Proxy(
    {},
    {
      get:
        (_t, tag: string) =>
        ({
          children,
          initial,
          whileInView: _whileInView,
          viewport: _viewport,
          transition: _transition,
          ...rest
        }: Record<string, unknown> & { children?: React.ReactNode }) =>
          React.createElement(
            tag,
            { ...rest, 'data-has-initial': initial !== undefined ? 'true' : undefined },
            children as React.ReactNode,
          ),
    },
  );
  return {
    motion: motionProxy,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    useReducedMotion: () => false,
  };
});

describe('Cuadrilla', () => {
  beforeEach(() => {
    motionSafeValue = true;
  });

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

  it('la sección entra con fade-up con motion habilitado: lleva initial real', () => {
    motionSafeValue = true;
    render(<Cuadrilla />);
    expect(screen.getByTestId('cuadrilla-section')).toHaveAttribute('data-has-initial', 'true');
  });

  it('con reduced-motion la sección ya está en su posición final, sin initial (gate real de useMotionSafe)', () => {
    motionSafeValue = false;
    render(<Cuadrilla />);
    expect(screen.getByTestId('cuadrilla-section')).not.toHaveAttribute('data-has-initial');
  });
});

function hexToRgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgb(${r}, ${g}, ${b})`;
}
