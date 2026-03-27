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

  it('applies gradient background with color + alpha', () => {
    render(<Badge color="#F59E0B">Pending</Badge>);
    const badge = screen.getByText('Pending');
    expect(badge).toHaveStyle({
      background: 'linear-gradient(135deg, #F59E0B2E, #F59E0B14)',
    });
  });

  it('applies border with color + alpha', () => {
    render(<Badge color="#F59E0B">Pending</Badge>);
    const badge = screen.getByText('Pending');
    expect(badge.style.border).toContain('1px solid');
    expect(badge.style.border).toContain('245, 158, 11');
  });

  it('renders with different color variants correctly', () => {
    const { rerender } = render(<Badge color="#34D399">Success</Badge>);
    let badge = screen.getByText('Success');
    expect(badge).toHaveStyle({
      color: '#34D399',
      background: 'linear-gradient(135deg, #34D3992E, #34D39914)',
    });

    rerender(<Badge color="#FB7185">Danger</Badge>);
    badge = screen.getByText('Danger');
    expect(badge).toHaveStyle({
      color: '#FB7185',
      background: 'linear-gradient(135deg, #FB71852E, #FB718514)',
    });

    rerender(<Badge color="#F59E0B">Warning</Badge>);
    badge = screen.getByText('Warning');
    expect(badge).toHaveStyle({
      color: '#F59E0B',
      background: 'linear-gradient(135deg, #F59E0B2E, #F59E0B14)',
    });
  });

  it('applies base layout classes', () => {
    render(<Badge color="#60A5FA">Info</Badge>);
    const badge = screen.getByText('Info');
    expect(badge.className).toContain('inline-flex');
    expect(badge.className).toContain('items-center');
    expect(badge.className).toContain('gap-1');
    expect(badge.className).toContain('rounded-full');
    expect(badge.className).toContain('font-extrabold');
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

  describe('glow variant', () => {
    it('defaults to glow=false (no box-shadow)', () => {
      render(<Badge color="#34D399">Default</Badge>);
      const badge = screen.getByText('Default');
      expect(badge.style.boxShadow).toBe('');
    });

    it('applies glow alphas and box-shadow when glow=true', () => {
      render(
        <Badge color="#34D399" glow>
          Glowing
        </Badge>,
      );
      const badge = screen.getByText('Glowing');
      expect(badge).toHaveStyle({
        background: 'linear-gradient(135deg, #34D39940, #34D3991F)',
      });
      expect(badge.style.border).toContain('1px solid');
      expect(badge.style.border).toContain('52, 211, 153');
      expect(badge.style.boxShadow).toBe('0 0 10px #34D39926');
    });
  });

  it('merges custom style prop', () => {
    render(
      <Badge color="#60A5FA" style={{ marginTop: '8px' }}>
        Styled
      </Badge>,
    );
    const badge = screen.getByText('Styled');
    expect(badge).toHaveStyle({ marginTop: '8px' });
    expect(badge).toHaveStyle({ color: '#60A5FA' });
  });
});
