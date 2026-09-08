import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const useInboxSync = vi.fn();
const inbox = { unreadCount: 0 };

vi.mock('../hooks/useInbox', () => ({
  useInbox: () => inbox,
  useInboxSync: () => useInboxSync(),
}));

vi.mock('./InboxSheet', () => ({
  InboxSheet: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="inbox-sheet">
        <button type="button" onClick={onClose}>
          close
        </button>
      </div>
    ) : null,
}));

import { InboxBell } from './InboxBell';

describe('InboxBell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    inbox.unreadCount = 0;
  });

  it('hides the badge when nothing is unread', () => {
    render(<InboxBell />);

    expect(screen.queryByTestId('inbox-unread-count')).not.toBeInTheDocument();
  });

  it('counts the unread notices', () => {
    inbox.unreadCount = 3;

    render(<InboxBell />);

    expect(screen.getByTestId('inbox-unread-count')).toHaveTextContent('3');
  });

  it('caps the badge instead of stretching the header', () => {
    inbox.unreadCount = 42;

    render(<InboxBell />);

    expect(screen.getByTestId('inbox-unread-count')).toHaveTextContent('9+');
  });

  it('opens and closes the sheet', () => {
    render(<InboxBell />);

    expect(screen.queryByTestId('inbox-sheet')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('inbox.open'));
    expect(screen.getByTestId('inbox-sheet')).toBeInTheDocument();

    fireEvent.click(screen.getByText('close'));
    expect(screen.queryByTestId('inbox-sheet')).not.toBeInTheDocument();
  });

  it('keeps the inbox in sync while it is on screen', () => {
    render(<InboxBell />);

    expect(useInboxSync).toHaveBeenCalled();
  });
});
