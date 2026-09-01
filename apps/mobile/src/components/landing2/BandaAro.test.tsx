import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BandaAro } from './BandaAro';

let motionSafeValue = true;
vi.mock('../../lib/motion', () => ({
  spring: { gentle: {}, snappy: {}, bouncy: {} },
  useMotionSafe: () => motionSafeValue,
}));

// Local override of the global framer-motion mock (src/test/setup.ts): that one
// strips `initial`/`whileInView` entirely and renders `motion.circle` as a plain
// `<circle>`, so a test counting <circle> elements can't tell the animated
// branch (motion.circle) from the reduced-motion branch (plain circle) -- both
// render 7 circles either way. Surface `initial` as a data attribute so the gate
// test discriminates the real branch, not just the label the component sets for
// itself.
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

  it('el aro central se cierra con motion habilitado: los 6 arcos llevan initial real', () => {
    motionSafeValue = true;
    const { container } = render(<BandaAro />);
    const svg = container.querySelector('[data-testid="banda-aro-center"] svg');
    expect(svg).toHaveAttribute('data-motion', 'closing');
    const circles = svg?.querySelectorAll('circle') ?? [];
    expect(circles).toHaveLength(7); // 1 traza + 6 arcos
    const arcs = [...circles].slice(1);
    arcs.forEach((c) => expect(c).toHaveAttribute('data-has-initial', 'true'));
  });

  it('con reduced-motion el aro central queda ya cerrado, sin motion.circle (gate real de useMotionSafe)', () => {
    motionSafeValue = false;
    const { container } = render(<BandaAro />);
    const svg = container.querySelector('[data-testid="banda-aro-center"] svg');
    expect(svg).toHaveAttribute('data-motion', 'static');
    const circles = svg?.querySelectorAll('circle') ?? [];
    expect(circles).toHaveLength(7);
    const arcs = [...circles].slice(1);
    arcs.forEach((c) => expect(c).not.toHaveAttribute('data-has-initial'));
  });
});
