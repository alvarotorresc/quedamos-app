import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { NavIsla, GITHUB_URL } from './NavIsla';

describe('NavIsla', () => {
  it('pinta el wordmark, el label de código abierto y el CTA con href a /login', () => {
    render(
      <MemoryRouter>
        <NavIsla />
      </MemoryRouter>,
    );
    expect(screen.getByText('landing2.nav.brand')).toBeInTheDocument();
    const cta = screen.getByRole('link', { name: /landing2\.cta/ });
    expect(cta).toHaveAttribute('href', '/login');
  });

  it('«Código abierto» lleva al repo en una pestaña nueva', () => {
    render(
      <MemoryRouter>
        <NavIsla />
      </MemoryRouter>,
    );
    const repo = screen.getByRole('link', { name: 'landing2.nav.codeOpen' });
    expect(repo).toHaveAttribute('href', GITHUB_URL);
    expect(repo).toHaveAttribute('target', '_blank');
    expect(repo).toHaveAttribute('rel', 'noreferrer');
  });

  it('el logo es aria-hidden: el nombre accesible del grupo lo da el wordmark de texto', () => {
    const { container } = render(
      <MemoryRouter>
        <NavIsla />
      </MemoryRouter>,
    );
    const logoSvg = container.querySelector('svg[viewBox="-120 -120 240 240"]');
    expect(logoSvg).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('landing2.nav.brand')).toBeInTheDocument();
  });
});
