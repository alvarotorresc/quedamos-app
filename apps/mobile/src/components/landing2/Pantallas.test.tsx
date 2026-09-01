import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Pantallas } from './Pantallas';

describe('Pantallas', () => {
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
    expect(screen.getByRole('button', { name: 'landing2.pantallas.events.upcoming' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'landing2.pantallas.events.past' })).toBeInTheDocument();
  });

  it('la pantalla Cuadrilla lleva el ring, dos miembros y el CTA de invitar', () => {
    render(<Pantallas />);
    expect(screen.getByText('landing2.cuadrilla.names.vera')).toBeInTheDocument();
    expect(screen.getByText('landing2.cuadrilla.names.iris')).toBeInTheDocument();
    expect(screen.getByText('landing2.pantallas.group.invite')).toBeInTheDocument();
    expect(screen.getAllByText('V')).toHaveLength(1);
    expect(screen.getAllByText('T')).toHaveLength(1);
  });
});
