import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Proceso } from './Proceso';

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

const STEP_KEYS = ['sondear', 'cierra', 'quedamos'] as const;

describe('Proceso', () => {
  beforeEach(() => {
    motionSafeValue = true;
  });

  it('pinta el titular y los 3 pasos con índice, título y descripción', () => {
    render(<Proceso />);
    expect(screen.getByText('landing2.proceso.title')).toBeInTheDocument();
    STEP_KEYS.forEach((step) => {
      expect(screen.getByText(`landing2.proceso.steps.${step}.index`)).toBeInTheDocument();
      expect(screen.getByText(`landing2.proceso.steps.${step}.title`)).toBeInTheDocument();
      expect(screen.getByText(`landing2.proceso.steps.${step}.description`)).toBeInTheDocument();
    });
  });

  it('cada paso lleva su nodo-aro (3 aros reales de ui/Aro)', () => {
    const { container } = render(<Proceso />);
    // Cada Aro pinta al menos la traza; 3 nodos => al menos 3 svgs de aro.
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThanOrEqual(3);
  });

  it('el refuerzo de la traza de Sondear no engrosa el aro-wrapper de 116px que lo envuelve (solo el svg de Aro lo lleva)', () => {
    render(<Proceso />);
    STEP_KEYS.forEach((step) => {
      const stepEl = screen.getByTestId(`proceso-step-${step}`);
      // El wrapper de 116px es el primer div hijo directo del paso.
      const nodeWrapper = stepEl.querySelector(':scope > div');
      expect(nodeWrapper).not.toBeNull();
      expect(nodeWrapper).toHaveClass('border-subtle');
      expect(nodeWrapper).not.toHaveClass('proceso-sondear-trace');

      const aroRoot = nodeWrapper?.querySelector('svg')?.parentElement;
      if (step === 'sondear') {
        expect(aroRoot).toHaveClass('proceso-sondear-trace');
      } else {
        expect(aroRoot).not.toHaveClass('proceso-sondear-trace');
      }
    });
  });

  it('los 3 nodos entran con fade-up con motion habilitado: llevan initial real', () => {
    motionSafeValue = true;
    render(<Proceso />);
    STEP_KEYS.forEach((step) => {
      expect(screen.getByTestId(`proceso-step-${step}`)).toHaveAttribute(
        'data-has-initial',
        'true',
      );
    });
  });

  it('con reduced-motion los 3 nodos ya están en su posición final, sin initial (gate real de useMotionSafe)', () => {
    motionSafeValue = false;
    render(<Proceso />);
    STEP_KEYS.forEach((step) => {
      expect(screen.getByTestId(`proceso-step-${step}`)).not.toHaveAttribute('data-has-initial');
    });
  });
});
