import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Proceso } from './Proceso';

describe('Proceso', () => {
  it('pinta el titular y los 3 pasos con índice, título y descripción', () => {
    render(<Proceso />);
    expect(screen.getByText('landing2.proceso.title')).toBeInTheDocument();
    (['sondear', 'cierra', 'quedamos'] as const).forEach((step) => {
      expect(screen.getByText(`landing2.proceso.steps.${step}.index`)).toBeInTheDocument();
      expect(screen.getByText(`landing2.proceso.steps.${step}.title`)).toBeInTheDocument();
      expect(screen.getByText(`landing2.proceso.steps.${step}.description`)).toBeInTheDocument();
    });
  });

  it('cada paso lleva su nodo-aro (3 aros reales de ui/Aro)', () => {
    const { container } = render(<Proceso />);
    // Cada Aro pinta al menos la traza; 3 nodos => al menos 3 svgs de aro.
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThanOrEqual(3);
  });
});
