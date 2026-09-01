import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BandaAro } from './BandaAro';

let motionSafeValue = true;
vi.mock('../../lib/motion', () => ({
  spring: { gentle: {}, snappy: {}, bouncy: {} },
  useMotionSafe: () => motionSafeValue,
}));

describe('BandaAro', () => {
  beforeEach(() => {
    motionSafeValue = true;
  });

  it('pinta el titular, el subtítulo y los dos estados del aro', () => {
    render(<BandaAro />);
    expect(screen.getByText('landing2.banda.title')).toBeInTheDocument();
    expect(screen.getByText('landing2.banda.subtitle')).toBeInTheDocument();
    expect(screen.getByText('landing2.banda.pending')).toBeInTheDocument();
    expect(screen.getByText('landing2.banda.sealed')).toBeInTheDocument();
    expect(screen.getByText('landing2.banda.weekday')).toBeInTheDocument();
    expect(screen.getByText('landing2.banda.dayNumber')).toBeInTheDocument();
  });

  it('el aro central se cierra con motion habilitado', () => {
    motionSafeValue = true;
    const { container } = render(<BandaAro />);
    const svg = container.querySelector('[data-testid="banda-aro-center"] svg');
    expect(svg).toHaveAttribute('data-motion', 'closing');
  });

  it('con reduced-motion el aro central queda ya cerrado, sin animación (gate de useMotionSafe)', () => {
    motionSafeValue = false;
    const { container } = render(<BandaAro />);
    const svg = container.querySelector('[data-testid="banda-aro-center"] svg');
    expect(svg).toHaveAttribute('data-motion', 'static');
    // Sin reduced-motion, los arcos son <circle> planos (sin motion.circle):
    // 1 traza + 6 arcos.
    const circles = svg?.querySelectorAll('circle');
    expect(circles).toHaveLength(7);
  });
});
