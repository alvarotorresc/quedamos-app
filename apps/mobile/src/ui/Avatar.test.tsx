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
    const element = document.querySelector('.rounded-full');
    expect(element).toBeInTheDocument();
  });

  it('handles single character name', () => {
    render(<Avatar name="X" color="#60A5FA" />);
    expect(screen.getByText('X')).toBeInTheDocument();
  });

  it('pinta color pleno con inicial en tinta de día', () => {
    render(<Avatar name="Álvaro" color="#60A5FA" data-testid="avatar" />);
    const el = screen.getByTestId('avatar');
    expect(el).toHaveStyle({ background: '#60A5FA', color: '#33302A' });
    expect(el).toHaveTextContent('Á');
  });

  it('no inyecta variables de glow', () => {
    render(<Avatar name="Sara" color="#F472B6" data-testid="avatar" />);
    expect(screen.getByTestId('avatar').getAttribute('style')).not.toContain('--glow-color');
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
    // fontSize = size * 0.38 = 15.2
    expect(avatar).toHaveStyle({ fontSize: '15.2px' });
  });

  it('renders with circular border radius', () => {
    render(<Avatar name="Ana" color="#34D399" size={40} />);
    const avatar = screen.getByText('AN');
    expect(avatar.className).toContain('rounded-full');
  });

  it('calls onClick handler when clicked', () => {
    const handleClick = vi.fn();
    render(<Avatar name="Click Me" color="#A78BFA" onClick={handleClick} />);
    fireEvent.click(screen.getByText('CM'));
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it('applies custom className', () => {
    render(<Avatar name="Test" color="#60A5FA" className="ml-2" />);
    const avatar = screen.getByText('TE');
    expect(avatar.className).toContain('ml-2');
  });

  it('handles three-word name using first two words', () => {
    render(<Avatar name="Ana Maria Lopez" color="#FB7185" />);
    expect(screen.getByText('AM')).toBeInTheDocument();
  });

  it('applies cursor-pointer class when clickable', () => {
    const handleClick = vi.fn();
    render(<Avatar name="Click" color="#60A5FA" onClick={handleClick} />);
    const avatar = screen.getByText('CL');
    expect(avatar.className).toContain('cursor-pointer');
  });

  it('does not apply cursor-pointer class when not clickable', () => {
    render(<Avatar name="Static" color="#60A5FA" />);
    const avatar = screen.getByText('ST');
    expect(avatar.className).not.toContain('cursor-pointer');
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

  it('calls onClick when pressing Enter on a clickable avatar', () => {
    const handleClick = vi.fn();
    render(<Avatar name="Keyboard" color="#60A5FA" onClick={handleClick} data-testid="avatar" />);
    fireEvent.keyDown(screen.getByTestId('avatar'), { key: 'Enter' });
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it('calls onClick when pressing Space on a clickable avatar', () => {
    const handleClick = vi.fn();
    render(<Avatar name="Keyboard" color="#60A5FA" onClick={handleClick} data-testid="avatar" />);
    fireEvent.keyDown(screen.getByTestId('avatar'), { key: ' ' });
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it('prevents default when pressing Space to avoid page scroll', () => {
    const handleClick = vi.fn();
    render(<Avatar name="Keyboard" color="#60A5FA" onClick={handleClick} data-testid="avatar" />);
    const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    screen.getByTestId('avatar').dispatchEvent(event);
    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('renders identically with pulse=true and without pulse (no-op)', () => {
    const { container: containerWithPulse } = render(
      <Avatar name="Test" color="#60A5FA" pulse={true} data-testid="avatar-pulse" />,
    );
    const { container: containerWithoutPulse } = render(
      <Avatar name="Test" color="#60A5FA" data-testid="avatar-no-pulse" />,
    );

    const withPulse = containerWithPulse.querySelector('[data-testid="avatar-pulse"]');
    const withoutPulse = containerWithoutPulse.querySelector('[data-testid="avatar-no-pulse"]');

    expect(withPulse?.className).toBe(withoutPulse?.className);
    expect(withPulse?.getAttribute('style')).toBe(withoutPulse?.getAttribute('style'));
  });
});
