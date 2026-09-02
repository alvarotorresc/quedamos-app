import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Toggle } from './Toggle';

describe('Toggle', () => {
  it('es un switch accesible que refleja el estado', () => {
    render(<Toggle checked={false} onChange={() => {}} label="Tema oscuro" />);
    const sw = screen.getByRole('switch', { name: 'Tema oscuro' });
    expect(sw).toHaveAttribute('aria-checked', 'false');
  });

  it('encendido pinta la pista con el color dado y muestra la marca', () => {
    render(<Toggle checked onChange={() => {}} label="Tema oscuro" color="#60A5FA" />);
    const sw = screen.getByRole('switch', { name: 'Tema oscuro' });
    expect(sw).toHaveAttribute('aria-checked', 'true');
    expect(sw).toHaveStyle({ background: '#60A5FA' });
    expect(sw.querySelector('svg')).not.toBeNull();
  });

  it('apagado no tiene marca ni color', () => {
    render(<Toggle checked={false} onChange={() => {}} label="Tema oscuro" color="#60A5FA" />);
    const sw = screen.getByRole('switch', { name: 'Tema oscuro' });
    expect(sw.querySelector('svg')).toBeNull();
    expect(sw).not.toHaveStyle({ background: '#60A5FA' });
  });

  it('al pulsar pide el estado contrario', () => {
    const onChange = vi.fn();
    render(<Toggle checked onChange={onChange} label="Tema oscuro" />);
    fireEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('deshabilitado no responde', () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} label="Tema oscuro" disabled />);
    fireEvent.click(screen.getByRole('switch'));
    expect(onChange).not.toHaveBeenCalled();
  });
});
