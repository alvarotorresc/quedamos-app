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

  it('el aro central se cierra con motion habilitado: los 6 arcos llevan initial real, sin traza de fondo', () => {
    motionSafeValue = true;
    const { container } = render(<BandaAro />);
    const svg = container.querySelector('[data-testid="banda-aro-center"] svg');
    expect(svg).toHaveAttribute('data-motion', 'closing');
    const circles = svg?.querySelectorAll('circle') ?? [];
    // Sin círculo de traza detrás: el aro central está siempre cerrado (los
    // 6 slots on), así que una traza de fondo solo dejaría churretes grises
    // en los huecos entre arcos.
    expect(circles).toHaveLength(6);
    [...circles].forEach((c) => expect(c).toHaveAttribute('data-has-initial', 'true'));
  });

  it('con reduced-motion el aro central queda ya cerrado, sin motion.circle (gate real de useMotionSafe)', () => {
    motionSafeValue = false;
    const { container } = render(<BandaAro />);
    const svg = container.querySelector('[data-testid="banda-aro-center"] svg');
    expect(svg).toHaveAttribute('data-motion', 'static');
    const circles = svg?.querySelectorAll('circle') ?? [];
    expect(circles).toHaveLength(6);
    [...circles].forEach((c) => expect(c).not.toHaveAttribute('data-has-initial'));
  });

  it('el aro central no pinta --banda-track: los huecos entre arcos quedan limpios', () => {
    const { container } = render(<BandaAro />);
    const svg = container.querySelector('[data-testid="banda-aro-center"] svg');
    const strokes = [...(svg?.querySelectorAll('circle') ?? [])].map((c) => c.getAttribute('stroke'));
    expect(strokes).not.toContain('var(--banda-track)');
  });

  it('los trazos atenuados de la banda usan la tinta del tema CONTRARIO al de la página, no --app-border/--app-apagado', () => {
    const { container } = render(<BandaAro />);
    // Ni el aro central ni el icono "en el aire" deben referenciar los tokens
    // del tema de la página: quedarían mal en la banda invertida (ver el
    // comentario de BANDA_SCOPE en el componente).
    const strokes = [...container.querySelectorAll('circle')].map((c) => c.getAttribute('stroke'));
    expect(strokes).not.toContain('var(--app-border)');
    expect(strokes).not.toContain('var(--app-apagado)');
    expect(strokes).toContain('var(--banda-track)');
    expect(strokes).toContain('var(--banda-apagado)');

    // Pin de los dos valores reales, uno por tema, contra los dos artboards
    // (Main.dc.html:148-150 día, LandingNoche.dc.html:148-150 noche).
    const styleText = container.querySelector('style')?.textContent ?? '';
    expect(styleText).toContain('--banda-track: rgba(51, 48, 42, 0.32)');
    expect(styleText).toContain('--banda-apagado: #C9C0AE');
    expect(styleText).toContain('.light .landing2-banda-scope');
    expect(styleText).toContain('--banda-track: rgba(242, 239, 231, 0.32)');
    expect(styleText).toContain('--banda-apagado: #5E584C');
  });
});
