import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Renuncias } from './Renuncias';

const ITEMS = ['interrogate', 'confetti', 'streaks', 'punish', 'shoutEmoji', 'aiPlan'] as const;

describe('Renuncias', () => {
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
});
