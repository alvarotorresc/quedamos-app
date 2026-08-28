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
    expect(button.className).toContain('bg-primary-solid');
    expect(button.className).toContain('text-on-primary');
  });

  it('applies secondary variant styles when variant is secondary', () => {
    render(<Button variant="secondary">Secondary</Button>);
    const button = screen.getByRole('button', { name: 'Secondary' });
    expect(button.className).toContain('bg-transparent');
    expect(button.className).toContain('text-text');
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
    expect(button.className).toContain('disabled:opacity-40');
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
    expect(button.className).toContain('rounded-pill');
    expect(button.className).toContain('font-bold');
    expect(button.className).toContain('transition-[filter]');
  });

  it('applies md size styles by default', () => {
    render(<Button>Default size</Button>);
    const button = screen.getByRole('button', { name: 'Default size' });
    expect(button.className).toContain('py-3');
    expect(button.className).toContain('text-sm');
  });

  it('applies sm size styles when size is sm', () => {
    render(<Button size="sm">Small</Button>);
    const button = screen.getByRole('button', { name: 'Small' });
    expect(button.className).toContain('py-2');
    expect(button.className).toContain('text-xs');
    expect(button.className).not.toContain('py-3');
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

  it('is disabled when loading is true', () => {
    render(<Button loading>Loading</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('does not call onClick when loading', () => {
    const handleClick = vi.fn();
    render(
      <Button loading onClick={handleClick}>
        Loading
      </Button>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('is disabled when both loading and disabled are true', () => {
    render(
      <Button loading disabled>
        Button
      </Button>,
    );
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('is not disabled when loading is false', () => {
    render(<Button loading={false}>Button</Button>);
    expect(screen.getByRole('button', { name: 'Button' })).not.toBeDisabled();
  });
});
