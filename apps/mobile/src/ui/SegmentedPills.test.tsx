import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SegmentedPills } from './SegmentedPills';

const OPTS = [
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
] as const;

describe('SegmentedPills', () => {
  it('marca el activo y notifica cambios', () => {
    const onChange = vi.fn();
    render(<SegmentedPills options={[...OPTS]} value="week" onChange={onChange} />);
    expect(screen.getByRole('tab', { name: 'Semana' }).className).toContain('bg-primary-solid');
    fireEvent.click(screen.getByRole('tab', { name: 'Mes' }));
    expect(onChange).toHaveBeenCalledWith('month');
  });

  it('expone el grupo como tablist y cada opción como tab con aria-selected', () => {
    render(<SegmentedPills options={[...OPTS]} value="week" onChange={vi.fn()} />);

    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Semana' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Mes' })).toHaveAttribute('aria-selected', 'false');
  });
});
