import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Renuncias } from './Renuncias';

const ITEMS = ['interrogate', 'confetti', 'streaks', 'punish', 'shoutEmoji', 'aiPlan'] as const;

let motionSafeValue = true;
vi.mock('../../lib/motion', () => ({
  spring: { gentle: {}, snappy: {}, bouncy: {} },
  useMotionSafe: () => motionSafeValue,
}));

// Local override of the global framer-motion mock (src/test/setup.ts): that one
// strips `initial` entirely, so a test asserting on it would pass identically
// whether or not the component actually gates the entrance behind
// useMotionSafe. Surface `initial` as a data attribute so the gate test
// discriminates the real branch (see 36c42f0 for the same fix on
// HeroPregunta/BandaAro).
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

describe('Renuncias', () => {
  beforeEach(() => {
    motionSafeValue = true;
  });

  it('pinta el titular, el subtítulo y las 6 renuncias tachadas', () => {
    render(<Renuncias />);
    expect(screen.getByText('landing2.renuncias.title')).toBeInTheDocument();
    expect(screen.getByText('landing2.renuncias.subtitle')).toBeInTheDocument();
    ITEMS.forEach((key) => {
      expect(screen.getByText(`landing2.renuncias.items.${key}.label`)).toBeInTheDocument();
      expect(screen.getByText(`landing2.renuncias.items.${key}.description`)).toBeInTheDocument();
    });
  });

  it('el tachado usa line-through de 5px en el token --app-error, no un hex suelto', () => {
    render(<Renuncias />);
    const label = screen.getByText('landing2.renuncias.items.confetti.label');
    expect(label.className).toContain('line-through');
    expect(label.style.textDecorationThickness).toBe('5px');
    expect(label.style.textDecorationColor).toBe('var(--app-error)');
  });

  it('la lista entra con fade-up con motion habilitado: lleva initial real', () => {
    motionSafeValue = true;
    render(<Renuncias />);
    expect(screen.getByTestId('renuncias-grid')).toHaveAttribute('data-has-initial', 'true');
  });

  it('con reduced-motion la lista ya está en su posición final, sin initial (gate real de useMotionSafe)', () => {
    motionSafeValue = false;
    render(<Renuncias />);
    expect(screen.getByTestId('renuncias-grid')).not.toHaveAttribute('data-has-initial');
  });
});
