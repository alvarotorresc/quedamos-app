import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Cierre } from './Cierre';
import { GITHUB_URL } from './NavIsla';

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

describe('Cierre', () => {
  beforeEach(() => {
    motionSafeValue = true;
  });

  it('pinta la cita, el subtítulo y el CTA con href a /login', () => {
    render(
      <MemoryRouter>
        <Cierre />
      </MemoryRouter>,
    );
    expect(screen.getByText('landing2.cierre.quote')).toBeInTheDocument();
    expect(screen.getByText('landing2.cierre.subtitle')).toBeInTheDocument();
    const cta = screen.getByRole('link', { name: /landing2\.cta/ });
    expect(cta).toHaveAttribute('href', '/login');
  });

  it('el footer enlaza «Ver el código en GitHub» al repo real', () => {
    render(
      <MemoryRouter>
        <Cierre />
      </MemoryRouter>,
    );
    const githubLink = screen.getByRole('link', { name: 'landing2.githubCta' });
    expect(githubLink).toHaveAttribute('href', GITHUB_URL);
    expect(githubLink).toHaveAttribute('target', '_blank');
    expect(screen.getByText('landing2.cierre.footer.languages')).toBeInTheDocument();
  });

  it('la sección entra con fade-up con motion habilitado: lleva initial real', () => {
    motionSafeValue = true;
    render(
      <MemoryRouter>
        <Cierre />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('cierre-section')).toHaveAttribute('data-has-initial', 'true');
  });

  it('con reduced-motion la sección ya está en su posición final, sin initial (gate real de useMotionSafe)', () => {
    motionSafeValue = false;
    render(
      <MemoryRouter>
        <Cierre />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('cierre-section')).not.toHaveAttribute('data-has-initial');
  });
});
