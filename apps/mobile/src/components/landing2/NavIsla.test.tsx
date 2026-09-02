import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { NavIsla } from './NavIsla';

describe('NavIsla', () => {
  it('pinta el wordmark, el label de código abierto y el CTA con href a /login', () => {
    render(
      <MemoryRouter>
        <NavIsla />
      </MemoryRouter>,
    );
    expect(screen.getByText('landing2.nav.brand')).toBeInTheDocument();
    expect(screen.getByText('landing2.nav.codeOpen')).toBeInTheDocument();
    const cta = screen.getByRole('link', { name: /landing2\.cta/ });
    expect(cta).toHaveAttribute('href', '/login');
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
