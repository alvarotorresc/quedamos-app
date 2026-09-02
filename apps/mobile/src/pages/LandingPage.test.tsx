import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import LandingPage from './LandingPage';

vi.mock('../hooks/useAnalytics', () => ({
  useScreenView: () => {},
}));

// One key per section that appears nowhere else in the page, used purely to
// pin each section's position in the rendered DOM — not a content assertion
// (each section already has its own render test in components/landing2/).
const SECTION_MARKERS = [
  'landing2.nav.brand',
  'landing2.hero.title',
  'landing2.banda.title',
  'landing2.pantallas.title',
  'landing2.cuadrilla.title',
  'landing2.proceso.title',
  'landing2.renuncias.title',
  'landing2.cierre.quote',
] as const;

describe('LandingPage', () => {
  it('composes the 8 landing2 sections in the artboard order (nav, hero, banda, pantallas, cuadrilla, proceso, renuncias, cierre)', () => {
    render(
      <MemoryRouter>
        <LandingPage onLogin={() => {}} onRegister={() => {}} />
      </MemoryRouter>,
    );

    const nodes = SECTION_MARKERS.map((key) => screen.getByText(key));
    for (let i = 0; i < nodes.length - 1; i += 1) {
      const relation = nodes[i].compareDocumentPosition(nodes[i + 1]);
      expect(relation & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it('renders every section exactly once', () => {
    render(
      <MemoryRouter>
        <LandingPage onLogin={() => {}} onRegister={() => {}} />
      </MemoryRouter>,
    );

    for (const key of SECTION_MARKERS) {
      expect(screen.getAllByText(key)).toHaveLength(1);
    }
  });

  it('wraps the section stack in a <main> landmark, with NavIsla outside it', () => {
    render(
      <MemoryRouter>
        <LandingPage onLogin={() => {}} onRegister={() => {}} />
      </MemoryRouter>,
    );

    const main = screen.getByRole('main');
    const nav = screen.getByRole('navigation');
    expect(main.contains(nav)).toBe(false);
    expect(main).toContainElement(screen.getByText('landing2.hero.title'));
    expect(main).toContainElement(screen.getByText('landing2.cierre.quote'));
  });
});
