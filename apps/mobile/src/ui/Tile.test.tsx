import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Tile } from './Tile';

describe('Tile', () => {
  it('pinta la etiqueta y el contenido', () => {
    render(
      <Tile label="Avisos" icon={<svg data-testid="icono" />}>
        <p>17 activos</p>
      </Tile>,
    );
    expect(screen.getByText('Avisos')).toBeInTheDocument();
    expect(screen.getByText('17 activos')).toBeInTheDocument();
    expect(screen.getByTestId('icono')).toBeInTheDocument();
  });

  it('ocupa dos columnas cuando se le pide', () => {
    const { container } = render(
      <Tile label="Cuenta" span={2}>
        <p>x</p>
      </Tile>,
    );
    expect(container.firstChild).toHaveClass('col-span-2');
  });

  it('con onClick es un botón que responde al toque', () => {
    const onClick = vi.fn();
    render(
      <Tile label="Avisos" onClick={onClick}>
        <p>x</p>
      </Tile>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Avisos/ }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('sin onClick no es un botón', () => {
    render(
      <Tile label="Tema">
        <p>x</p>
      </Tile>,
    );
    expect(screen.queryByRole('button')).toBeNull();
  });
});
