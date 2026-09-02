import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Aro } from './Aro';

const members = [
  { color: '#60A5FA', state: 'on' as const },
  { color: '#F59E0B', state: 'off' as const },
  { color: '#F472B6', state: 'apagado' as const },
];

describe('Aro', () => {
  it('pinta traza + un arco por miembro no-off', () => {
    const { container } = render(<Aro members={members} data-testid="aro" />);
    const circles = container.querySelectorAll('circle');
    // 1 traza + 2 arcos (on + apagado); off no pinta arco
    expect(circles).toHaveLength(3);
  });
  it('el arco on lleva el color del miembro y el apagado el token', () => {
    const { container } = render(<Aro members={members} />);
    const arcs = [...container.querySelectorAll('circle')].slice(1);
    expect(arcs[0].getAttribute('stroke')).toBe('#60A5FA');
    expect(arcs[1].getAttribute('stroke')).toBe('var(--app-apagado)');
  });
  it('renderiza children en el centro', () => {
    render(<Aro members={members}>3/6</Aro>);
    expect(screen.getByText('3/6')).toBeInTheDocument();
  });
});
