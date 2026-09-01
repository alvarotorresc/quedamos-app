import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Pantallas } from './Pantallas';

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

describe('Pantallas', () => {
  beforeEach(() => {
    motionSafeValue = true;
  });

  it('pinta el titular y las 3 pantallas (Semana, Quedadas, Cuadrilla)', () => {
    render(<Pantallas />);
    expect(screen.getByText('landing2.pantallas.title')).toBeInTheDocument();
    expect(screen.getByText('landing2.pantallas.week.title')).toBeInTheDocument();
    expect(screen.getByText('landing2.pantallas.events.title')).toBeInTheDocument();
    expect(screen.getByText('landing2.pantallas.group.title')).toBeInTheDocument();
  });

  it('la pantalla Semana lleva el día sellado con su CTA', () => {
    render(<Pantallas />);
    expect(screen.getByText('landing2.pantallas.week.allCan')).toBeInTheDocument();
    expect(screen.getByText('landing2.pantallas.week.askCta')).toBeInTheDocument();
  });

  it('la pantalla Quedadas lleva las dos quedadas y el CTA de proponer', () => {
    render(<Pantallas />);
    expect(screen.getByText('landing2.pantallas.events.dinnerTitle')).toBeInTheDocument();
    expect(screen.getByText('landing2.pantallas.events.padelTitle')).toBeInTheDocument();
    expect(screen.getByText('landing2.pantallas.events.propose')).toBeInTheDocument();
    expect(screen.getByText('landing2.pantallas.events.upcoming')).toBeInTheDocument();
    expect(screen.getByText('landing2.pantallas.events.past')).toBeInTheDocument();
  });

  it('las pestañas Próximas/Pasadas del mockup son decorativas, no botones interactivos', () => {
    render(<Pantallas />);
    expect(
      screen.queryByRole('button', { name: 'landing2.pantallas.events.upcoming' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'landing2.pantallas.events.past' }),
    ).not.toBeInTheDocument();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('la pantalla Cuadrilla lleva el ring, dos miembros y el CTA de invitar', () => {
    render(<Pantallas />);
    expect(screen.getByText('landing2.cuadrilla.names.vera')).toBeInTheDocument();
    expect(screen.getByText('landing2.cuadrilla.names.iris')).toBeInTheDocument();
    expect(screen.getByText('landing2.pantallas.group.invite')).toBeInTheDocument();
    expect(screen.getAllByText('V')).toHaveLength(1);
    expect(screen.getAllByText('T')).toHaveLength(1);
  });

  it('la sección entra con fade-up con motion habilitado: lleva initial real', () => {
    motionSafeValue = true;
    render(<Pantallas />);
    expect(screen.getByTestId('pantallas-section')).toHaveAttribute('data-has-initial', 'true');
  });

  it('con reduced-motion la sección ya está en su posición final, sin initial (gate real de useMotionSafe)', () => {
    motionSafeValue = false;
    render(<Pantallas />);
    expect(screen.getByTestId('pantallas-section')).not.toHaveAttribute('data-has-initial');
  });
});
