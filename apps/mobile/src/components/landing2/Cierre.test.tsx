import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Cierre } from './Cierre';
import { FEEDBACK_FORM_URL } from '../../lib/constants';
import { GITHUB_URL } from './NavIsla';

let motionSafeValue = true;
const changeLanguageMock = vi.fn();
let currentLanguage = 'es';
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: currentLanguage, changeLanguage: changeLanguageMock },
  }),
}));

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
  });

  it('el footer enlaza «Reportar un error» al formulario de feedback', () => {
    render(
      <MemoryRouter>
        <Cierre />
      </MemoryRouter>,
    );
    const feedbackLink = screen.getByRole('link', { name: 'landing2.feedbackCta' });
    expect(feedbackLink).toHaveAttribute('href', FEEDBACK_FORM_URL);
    expect(feedbackLink).toHaveAttribute('target', '_blank');
    expect(feedbackLink).toHaveAttribute('rel', 'noreferrer');
  });

  it('el footer cambia de idioma de verdad: English llama a changeLanguage("en")', () => {
    currentLanguage = 'es';
    render(
      <MemoryRouter>
        <Cierre />
      </MemoryRouter>,
    );
    const es = screen.getByRole('button', { name: 'Español' });
    const en = screen.getByRole('button', { name: 'English' });
    expect(es).toHaveAttribute('aria-pressed', 'true');
    expect(en).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(en);
    expect(changeLanguageMock).toHaveBeenCalledWith('en');
  });

  it('marca English como activo cuando el idioma actual es en', () => {
    currentLanguage = 'en';
    render(
      <MemoryRouter>
        <Cierre />
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true');
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
