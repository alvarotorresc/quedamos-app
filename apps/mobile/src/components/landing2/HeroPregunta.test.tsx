import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HeroPregunta } from './HeroPregunta';

let motionSafeValue = true;
vi.mock('../../lib/motion', () => ({
  spring: { gentle: {}, snappy: {}, bouncy: {} },
  useMotionSafe: () => motionSafeValue,
}));

// Local override of the global framer-motion mock (src/test/setup.ts): that one
// strips `animate`/`initial` entirely, so a test asserting on those props would
// pass identically whether or not the component actually gates them behind
// useMotionSafe. Surface `animate` as a data attribute instead so the gate test
// can discriminate the real branch, not just the data-motion label the
// component sets for itself.
vi.mock('framer-motion', async () => {
  const React = await import('react');
  const motionProxy = new Proxy(
    {},
    {
      get:
        (_t, tag: string) =>
        ({
          children,
          animate,
          initial: _initial,
          whileInView: _whileInView,
          viewport: _viewport,
          transition: _transition,
          ...rest
        }: Record<string, unknown> & { children?: React.ReactNode }) =>
          React.createElement(
            tag,
            { ...rest, 'data-has-animate': animate !== undefined ? 'true' : undefined },
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

describe('HeroPregunta', () => {
  beforeEach(() => {
    motionSafeValue = true;
  });

  it('pinta el titular, el subtítulo y el CTA con href a /login', () => {
    render(
      <MemoryRouter>
        <HeroPregunta />
      </MemoryRouter>,
    );
    expect(screen.getByText('landing2.hero.title')).toBeInTheDocument();
    expect(screen.getByText('landing2.hero.subtitle')).toBeInTheDocument();
    const cta = screen.getByRole('link', { name: /landing2\.cta/ });
    expect(cta).toHaveAttribute('href', '/login');
  });

  it('pinta el móvil de la Pregunta con sus claves i18n', () => {
    render(
      <MemoryRouter>
        <HeroPregunta />
      </MemoryRouter>,
    );
    expect(screen.getByText('landing2.hero.mockup.question')).toBeInTheDocument();
    expect(screen.getByText('landing2.hero.mockup.canGo')).toBeInTheDocument();
    expect(screen.getByText('landing2.hero.mockup.cannotGo')).toBeInTheDocument();
    expect(screen.getByText('landing2.hero.mockup.allCan')).toBeInTheDocument();
    expect(screen.getByText('landing2.hero.mockup.askCta')).toBeInTheDocument();
  });

  it('el halo respira con motion habilitado: lleva animate real, no solo la etiqueta', () => {
    motionSafeValue = true;
    render(
      <MemoryRouter>
        <HeroPregunta />
      </MemoryRouter>,
    );
    const halo = screen.getByTestId('hero-halo');
    expect(halo).toHaveAttribute('data-motion', 'breathing');
    expect(halo).toHaveAttribute('data-has-animate', 'true');
  });

  it('con reduced-motion el halo queda estático: sin animate (gate real de useMotionSafe)', () => {
    motionSafeValue = false;
    render(
      <MemoryRouter>
        <HeroPregunta />
      </MemoryRouter>,
    );
    const halo = screen.getByTestId('hero-halo');
    expect(halo).toHaveAttribute('data-motion', 'static');
    expect(halo).not.toHaveAttribute('data-has-animate');
  });
});
