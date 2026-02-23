import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('renders children text correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('renders as a button element', () => {
    render(<Button>Submit</Button>);
    expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
  });

  it('applies primary variant styles by default', () => {
    render(<Button>Primary</Button>);
    const button = screen.getByRole('button', { name: 'Primary' });
    expect(button.className).toContain('bg-primary-dark');
    expect(button.className).toContain('text-white');
  });

  it('applies secondary variant styles when variant is secondary', () => {
    render(<Button variant="secondary">Secondary</Button>);
    const button = screen.getByRole('button', { name: 'Secondary' });
    expect(button.className).toContain('bg-bg-input');
    expect(button.className).toContain('text-text-muted');
    expect(button.className).toContain('border');
  });

  it('calls onClick handler when clicked', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    fireEvent.click(screen.getByRole('button', { name: 'Click' }));
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it('does not call onClick when disabled', () => {
    const handleClick = vi.fn();
    render(
      <Button disabled onClick={handleClick}>
        Disabled
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Disabled' });
    fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('applies disabled styling via opacity class', () => {
    render(<Button disabled>Disabled</Button>);
    const button = screen.getByRole('button', { name: 'Disabled' });
    expect(button).toBeDisabled();
    expect(button.className).toContain('disabled:opacity-50');
  });

  it('applies custom className', () => {
    render(<Button className="w-full mt-4">Full</Button>);
    const button = screen.getByRole('button', { name: 'Full' });
    expect(button.className).toContain('w-full');
    expect(button.className).toContain('mt-4');
  });

  it('applies base styles regardless of variant', () => {
    render(<Button>Base</Button>);
    const button = screen.getByRole('button', { name: 'Base' });
    expect(button.className).toContain('rounded-btn');
    expect(button.className).toContain('font-semibold');
    expect(button.className).toContain('transition-all');
  });

  it('passes through native button attributes', () => {
    render(<Button type="submit">Submit</Button>);
    const button = screen.getByRole('button', { name: 'Submit' });
    expect(button).toHaveAttribute('type', 'submit');
  });

  it('renders complex children (JSX)', () => {
    render(
      <Button>
        <span data-testid="icon">*</span>
        Save
      </Button>,
    );
    expect(screen.getByTestId('icon')).toBeInTheDocument();
    expect(screen.getByText('Save')).toBeInTheDocument();
  });
});
