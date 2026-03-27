import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { EmptyState } from './EmptyState';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({
      children,
      initial,
      animate,
      transition,
      ...props
    }: React.ComponentProps<'div'> & {
      initial?: unknown;
      animate?: unknown;
      transition?: unknown;
    }) => <div {...props}>{children}</div>,
    h3: ({
      children,
      initial,
      animate,
      transition,
      ...props
    }: React.ComponentProps<'h3'> & {
      initial?: unknown;
      animate?: unknown;
      transition?: unknown;
    }) => <h3 {...props}>{children}</h3>,
    p: ({
      children,
      initial,
      animate,
      transition,
      ...props
    }: React.ComponentProps<'p'> & {
      initial?: unknown;
      animate?: unknown;
      transition?: unknown;
    }) => <p {...props}>{children}</p>,
    button: ({
      children,
      initial,
      animate,
      transition,
      whileTap,
      ...props
    }: React.ComponentProps<'button'> & {
      initial?: unknown;
      animate?: unknown;
      transition?: unknown;
      whileTap?: unknown;
    }) => <button {...props}>{children}</button>,
    span: ({
      children,
      animate,
      transition,
      ...props
    }: React.ComponentProps<'span'> & {
      animate?: unknown;
      transition?: unknown;
    }) => <span {...props}>{children}</span>,
  },
}));

describe('EmptyState', () => {
  const defaultProps = {
    emoji: '📅',
    title: 'No plans yet',
    description: 'Create your first plan to get started.',
  };

  it('renders emoji, title, and description', () => {
    render(<EmptyState {...defaultProps} />);
    expect(screen.getByText('📅')).toBeInTheDocument();
    expect(screen.getByText('No plans yet', { selector: 'h3' })).toBeInTheDocument();
    expect(screen.getByText('Create your first plan to get started.')).toBeInTheDocument();
  });

  it('renders the title as an h3 element', () => {
    render(<EmptyState {...defaultProps} />);
    const heading = screen.getByText('No plans yet');
    expect(heading.tagName).toBe('H3');
  });

  it('renders the description as a p element', () => {
    render(<EmptyState {...defaultProps} />);
    const desc = screen.getByText('Create your first plan to get started.');
    expect(desc.tagName).toBe('P');
  });

  it('renders action button when action and onAction are provided', () => {
    const handleAction = vi.fn();
    render(<EmptyState {...defaultProps} action="Create plan" onAction={handleAction} />);
    expect(screen.getByRole('button', { name: 'Create plan' })).toBeInTheDocument();
  });

  it('calls onAction when the action button is clicked', () => {
    const handleAction = vi.fn();
    render(<EmptyState {...defaultProps} action="Create plan" onAction={handleAction} />);
    fireEvent.click(screen.getByRole('button', { name: 'Create plan' }));
    expect(handleAction).toHaveBeenCalledOnce();
  });

  it('does not render action button when action is missing', () => {
    const handleAction = vi.fn();
    render(<EmptyState {...defaultProps} onAction={handleAction} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('does not render action button when onAction is missing', () => {
    render(<EmptyState {...defaultProps} action="Create plan" />);
    expect(screen.queryByRole('button', { name: 'Create plan' })).not.toBeInTheDocument();
  });

  it('renders secondary action when both secondaryAction and onSecondaryAction are provided', () => {
    const handleSecondary = vi.fn();
    render(
      <EmptyState
        {...defaultProps}
        secondaryAction="Learn more"
        onSecondaryAction={handleSecondary}
      />,
    );
    expect(screen.getByRole('button', { name: 'Learn more' })).toBeInTheDocument();
  });

  it('calls onSecondaryAction when the secondary button is clicked', () => {
    const handleSecondary = vi.fn();
    render(
      <EmptyState
        {...defaultProps}
        secondaryAction="Learn more"
        onSecondaryAction={handleSecondary}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Learn more' }));
    expect(handleSecondary).toHaveBeenCalledOnce();
  });

  it('does not render secondary action when secondaryAction is missing', () => {
    const handleSecondary = vi.fn();
    render(<EmptyState {...defaultProps} onSecondaryAction={handleSecondary} />);
    const buttons = screen.queryAllByRole('button');
    expect(buttons).toHaveLength(0);
  });

  it('does not render secondary action when onSecondaryAction is missing', () => {
    render(<EmptyState {...defaultProps} secondaryAction="Learn more" />);
    expect(screen.queryByRole('button', { name: 'Learn more' })).not.toBeInTheDocument();
  });

  it('renders both action and secondary action together', () => {
    const handleAction = vi.fn();
    const handleSecondary = vi.fn();
    render(
      <EmptyState
        {...defaultProps}
        action="Create plan"
        onAction={handleAction}
        secondaryAction="Learn more"
        onSecondaryAction={handleSecondary}
      />,
    );
    expect(screen.getByRole('button', { name: 'Create plan' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Learn more' })).toBeInTheDocument();
  });

  it('applies centered layout classes', () => {
    const { container } = render(<EmptyState {...defaultProps} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('flex');
    expect(root.className).toContain('flex-col');
    expect(root.className).toContain('items-center');
    expect(root.className).toContain('text-center');
  });

  it('applies text styling classes to title', () => {
    render(<EmptyState {...defaultProps} />);
    const title = screen.getByText('No plans yet');
    expect(title.className).toContain('font-extrabold');
    expect(title.className).toContain('text-text');
  });

  it('applies text styling classes to description', () => {
    render(<EmptyState {...defaultProps} />);
    const desc = screen.getByText('Create your first plan to get started.');
    expect(desc.className).toContain('text-text-muted');
    expect(desc.className).toContain('text-sm');
  });

  it('applies secondary button styling classes', () => {
    render(
      <EmptyState {...defaultProps} secondaryAction="Learn more" onSecondaryAction={vi.fn()} />,
    );
    const secondaryBtn = screen.getByRole('button', {
      name: 'Learn more',
    });
    expect(secondaryBtn.className).toContain('text-primary');
    expect(secondaryBtn.className).toContain('text-xs');
    expect(secondaryBtn.className).toContain('font-bold');
  });
});
