import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Badge } from './Badge';

describe('Badge', () => {
  it('renders text content', () => {
    render(<Badge variant="confirmed">Confirmed</Badge>);
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
  });

  it('renders as a span element', () => {
    render(<Badge variant="confirmed">Status</Badge>);
    const badge = screen.getByText('Status');
    expect(badge.tagName).toBe('SPAN');
  });

  it('defaults to the neutral variant when none is passed', () => {
    render(<Badge>Default</Badge>);
    const badge = screen.getByText('Default');
    expect(badge.className).toContain('border-strong');
    expect(badge.className).toContain('text-text');
    expect(badge.className).toContain('bg-transparent');
  });

  it('applies confirmed variant classes', () => {
    render(<Badge variant="confirmed">Confirmed</Badge>);
    const badge = screen.getByText('Confirmed');
    expect(badge.className).toContain('bg-success');
    expect(badge.className).toContain('text-on-primary');
  });

  it('applies pending variant classes', () => {
    render(<Badge variant="pending">Pending</Badge>);
    const badge = screen.getByText('Pending');
    expect(badge.className).toContain('bg-warning');
    expect(badge.className).toContain('text-on-primary');
  });

  it('applies cancelled variant classes', () => {
    render(<Badge variant="cancelled">Cancelled</Badge>);
    const badge = screen.getByText('Cancelled');
    expect(badge.className).toContain('bg-error');
    expect(badge.className).toContain('text-on-primary');
  });

  it('applies neutral variant classes', () => {
    render(<Badge variant="neutral">Neutral</Badge>);
    const badge = screen.getByText('Neutral');
    expect(badge.className).toContain('border-strong');
    expect(badge.className).toContain('bg-transparent');
  });

  it('re-renders with different variants correctly', () => {
    const { rerender } = render(<Badge variant="confirmed">Success</Badge>);
    let badge = screen.getByText('Success');
    expect(badge.className).toContain('bg-success');

    rerender(<Badge variant="cancelled">Danger</Badge>);
    badge = screen.getByText('Danger');
    expect(badge.className).toContain('bg-error');

    rerender(<Badge variant="pending">Warning</Badge>);
    badge = screen.getByText('Warning');
    expect(badge.className).toContain('bg-warning');
  });

  it('applies base layout classes', () => {
    render(<Badge variant="neutral">Info</Badge>);
    const badge = screen.getByText('Info');
    expect(badge.className).toContain('inline-flex');
    expect(badge.className).toContain('items-center');
    expect(badge.className).toContain('gap-1');
    expect(badge.className).toContain('rounded-pill');
    expect(badge.className).toContain('font-bold');
  });

  it('applies custom className', () => {
    render(
      <Badge variant="neutral" className="ml-2">
        Custom
      </Badge>,
    );
    const badge = screen.getByText('Custom');
    expect(badge.className).toContain('ml-2');
  });

  it('passes through native span attributes', () => {
    render(
      <Badge variant="neutral" data-testid="badge-el" title="Status badge">
        With attrs
      </Badge>,
    );
    const badge = screen.getByTestId('badge-el');
    expect(badge).toHaveAttribute('title', 'Status badge');
  });

  it('renders complex children (JSX)', () => {
    render(
      <Badge variant="confirmed">
        <span data-testid="icon">*</span>
        Active
      </Badge>,
    );
    expect(screen.getByTestId('icon')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('merges custom style prop', () => {
    render(
      <Badge variant="neutral" style={{ marginTop: '8px' }}>
        Styled
      </Badge>,
    );
    const badge = screen.getByText('Styled');
    expect(badge).toHaveStyle({ marginTop: '8px' });
  });
});
