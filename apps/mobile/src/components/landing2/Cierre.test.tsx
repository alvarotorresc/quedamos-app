import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { Cierre } from './Cierre';
import { GITHUB_URL } from './NavIsla';

describe('Cierre', () => {
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
});
