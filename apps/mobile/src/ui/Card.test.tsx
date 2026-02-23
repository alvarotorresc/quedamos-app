import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Card } from './Card';

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText('Card content')).toBeInTheDocument();
  });

  it('renders as a div element', () => {
    render(<Card data-testid="card">Content</Card>);
    const card = screen.getByTestId('card');
    expect(card.tagName).toBe('DIV');
  });

  it('applies default (unselected) border styles', () => {
    render(<Card data-testid="card">Content</Card>);
    const card = screen.getByTestId('card');
    expect(card.className).toContain('border-white/5');
    expect(card.className).not.toContain('border-primary/25');
  });

  it('applies selected styles when selected is true', () => {
    render(
      <Card data-testid="card" selected>
        Selected
      </Card>,
    );
    const card = screen.getByTestId('card');
    expect(card.className).toContain('border-primary/25');
    expect(card.className).toContain('bg-primary-dark/10');
  });

  it('applies unselected styles when selected is false', () => {
    render(
      <Card data-testid="card" selected={false}>
        Not selected
      </Card>,
    );
    const card = screen.getByTestId('card');
    expect(card.className).toContain('border-white/5');
    expect(card.className).not.toContain('border-primary/25');
  });

  it('calls onClick handler when clicked', () => {
    const handleClick = vi.fn();
    render(
      <Card data-testid="card" onClick={handleClick}>
        Clickable
      </Card>,
    );
    fireEvent.click(screen.getByTestId('card'));
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it('applies custom className', () => {
    render(
      <Card data-testid="card" className="my-custom-class">
        Styled
      </Card>,
    );
    const card = screen.getByTestId('card');
    expect(card.className).toContain('my-custom-class');
  });

  it('applies base styles', () => {
    render(<Card data-testid="card">Base</Card>);
    const card = screen.getByTestId('card');
    expect(card.className).toContain('bg-bg-card');
    expect(card.className).toContain('rounded-card');
    expect(card.className).toContain('transition-all');
  });

  it('renders complex children (JSX)', () => {
    render(
      <Card>
        <h2>Title</h2>
        <p>Description</p>
      </Card>,
    );
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
  });
});
