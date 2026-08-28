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
    expect(screen.getByRole('button', { name: 'Semana' }).className).toContain('bg-primary-solid');
    fireEvent.click(screen.getByRole('button', { name: 'Mes' }));
    expect(onChange).toHaveBeenCalledWith('month');
  });
});
