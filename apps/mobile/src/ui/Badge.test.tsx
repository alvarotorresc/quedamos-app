import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Badge } from './Badge';

describe('Badge', () => {
  it('renders text content', () => {
    render(<Badge color="#34D399">Confirmed</Badge>);
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
  });

  it('renders as a span element', () => {
    render(<Badge color="#34D399">Status</Badge>);
    const badge = screen.getByText('Status');
    expect(badge.tagName).toBe('SPAN');
  });

  it('applies color to text via inline style', () => {
    render(<Badge color="#FB7185">Cancelled</Badge>);
    const badge = screen.getByText('Cancelled');
    expect(badge).toHaveStyle({ color: '#FB7185' });
  });

  it('applies background with color + alpha via inline style', () => {
    render(<Badge color="#F59E0B">Pending</Badge>);
    const badge = screen.getByText('Pending');
    expect(badge).toHaveStyle({ background: '#F59E0B12' });
  });

  it('renders with different color variants correctly', () => {
    const { rerender } = render(<Badge color="#34D399">Success</Badge>);
    let badge = screen.getByText('Success');
    expect(badge).toHaveStyle({ color: '#34D399', background: '#34D39912' });

    rerender(<Badge color="#FB7185">Danger</Badge>);
    badge = screen.getByText('Danger');
    expect(badge).toHaveStyle({ color: '#FB7185', background: '#FB718512' });

    rerender(<Badge color="#F59E0B">Warning</Badge>);
    badge = screen.getByText('Warning');
    expect(badge).toHaveStyle({ color: '#F59E0B', background: '#F59E0B12' });
  });

  it('applies base layout classes', () => {
    render(<Badge color="#60A5FA">Info</Badge>);
    const badge = screen.getByText('Info');
    expect(badge.className).toContain('inline-flex');
    expect(badge.className).toContain('items-center');
    expect(badge.className).toContain('rounded-md');
    expect(badge.className).toContain('font-bold');
  });

  it('applies custom className', () => {
    render(
      <Badge color="#60A5FA" className="ml-2">
        Custom
      </Badge>,
    );
    const badge = screen.getByText('Custom');
    expect(badge.className).toContain('ml-2');
  });

  it('passes through native span attributes', () => {
    render(
      <Badge color="#60A5FA" data-testid="badge-el" title="Status badge">
        With attrs
      </Badge>,
    );
    const badge = screen.getByTestId('badge-el');
    expect(badge).toHaveAttribute('title', 'Status badge');
  });

  it('renders complex children (JSX)', () => {
    render(
      <Badge color="#A78BFA">
        <span data-testid="icon">*</span>
        Active
      </Badge>,
    );
    expect(screen.getByTestId('icon')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });
});
