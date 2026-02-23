import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Avatar } from './Avatar';

describe('Avatar', () => {
  it('renders initials from a two-word name', () => {
    render(<Avatar name="John Doe" color="#60A5FA" />);
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('renders first two characters for a single-word name', () => {
    render(<Avatar name="Alice" color="#60A5FA" />);
    expect(screen.getByText('AL')).toBeInTheDocument();
  });

  it('renders initials in uppercase', () => {
    render(<Avatar name="jane smith" color="#60A5FA" />);
    expect(screen.getByText('JS')).toBeInTheDocument();
  });

  it('handles name with extra whitespace', () => {
    render(<Avatar name="  Maria  Lopez  " color="#F472B6" />);
    expect(screen.getByText('ML')).toBeInTheDocument();
  });

  it('handles empty name gracefully', () => {
    render(<Avatar name="" color="#60A5FA" />);
    // Empty string sliced to 2 chars produces empty string, uppercased is still empty
    const element = document.querySelector('.flex.items-center');
    expect(element).toBeInTheDocument();
  });

  it('handles single character name', () => {
    render(<Avatar name="X" color="#60A5FA" />);
    expect(screen.getByText('X')).toBeInTheDocument();
  });

  it('applies color to the element style', () => {
    render(<Avatar name="Test User" color="#F59E0B" />);
    const avatar = screen.getByText('TU');
    expect(avatar).toHaveStyle({ color: '#F59E0B' });
  });

  it('applies background with color + alpha', () => {
    render(<Avatar name="Test User" color="#F59E0B" />);
    const avatar = screen.getByText('TU');
    expect(avatar).toHaveStyle({ background: '#F59E0B18' });
  });

  it('renders with default size of 32', () => {
    render(<Avatar name="Ana" color="#34D399" />);
    const avatar = screen.getByText('AN');
    expect(avatar).toHaveStyle({ width: '32px', height: '32px' });
  });

  it('renders with custom size', () => {
    render(<Avatar name="Ana" color="#34D399" size={48} />);
    const avatar = screen.getByText('AN');
    expect(avatar).toHaveStyle({ width: '48px', height: '48px' });
  });

  it('adjusts font size based on size prop', () => {
    render(<Avatar name="Ana" color="#34D399" size={40} />);
    const avatar = screen.getByText('AN');
    // fontSize = size * 0.3 = 12
    expect(avatar).toHaveStyle({ fontSize: '12px' });
  });

  it('adjusts border radius based on size prop', () => {
    render(<Avatar name="Ana" color="#34D399" size={40} />);
    const avatar = screen.getByText('AN');
    // borderRadius = size * 0.35 = 14
    expect(avatar).toHaveStyle({ borderRadius: '14px' });
  });

  it('calls onClick handler when clicked', () => {
    const handleClick = vi.fn();
    render(<Avatar name="Click Me" color="#A78BFA" onClick={handleClick} />);
    fireEvent.click(screen.getByText('CM'));
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it('sets role=button when onClick is provided', () => {
    const handleClick = vi.fn();
    render(<Avatar name="Click Me" color="#A78BFA" onClick={handleClick} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('sets tabIndex=0 when onClick is provided for keyboard access', () => {
    const handleClick = vi.fn();
    render(<Avatar name="Click Me" color="#A78BFA" onClick={handleClick} />);
    expect(screen.getByRole('button')).toHaveAttribute('tabIndex', '0');
  });

  it('does not set role=button when onClick is not provided', () => {
    render(<Avatar name="Static" color="#A78BFA" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<Avatar name="Test" color="#60A5FA" className="ml-2" />);
    const avatar = screen.getByText('TE');
    expect(avatar.className).toContain('ml-2');
  });

  it('handles three-word name using first two words', () => {
    render(<Avatar name="Ana Maria Lopez" color="#FB7185" />);
    // parts.length >= 2, so initials = first char of parts[0] + first char of parts[1]
    expect(screen.getByText('AM')).toBeInTheDocument();
  });
});
