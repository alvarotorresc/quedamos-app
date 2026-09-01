import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HeroPregunta } from './HeroPregunta';

let motionSafeValue = true;
vi.mock('../../lib/motion', () => ({
  spring: { gentle: {}, snappy: {}, bouncy: {} },
  useMotionSafe: () => motionSafeValue,
}));

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

  it('el halo respira con motion habilitado', () => {
    motionSafeValue = true;
    render(
      <MemoryRouter>
        <HeroPregunta />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('hero-halo')).toHaveAttribute('data-motion', 'breathing');
  });

  it('con reduced-motion el halo queda estático (gate de useMotionSafe)', () => {
    motionSafeValue = false;
    render(
      <MemoryRouter>
        <HeroPregunta />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('hero-halo')).toHaveAttribute('data-motion', 'static');
  });
});
