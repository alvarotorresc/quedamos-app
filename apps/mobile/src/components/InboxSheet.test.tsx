import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { InboxNotification } from '../services/inbox';

// IonModal is a Stencil web component that never presents under jsdom: render the
// children straight when isOpen, same pattern as AvailabilityDetailModal.
vi.mock('@ionic/react', () => ({
  IonModal: ({ isOpen, children }: { isOpen: boolean; children: ReactNode }) =>
    isOpen ? <div data-testid="ion-modal">{children}</div> : null,
}));

const push = vi.fn();
vi.mock('react-router-dom', () => ({
  useHistory: () => ({ push }),
}));

const CURRENT_GROUP = {
  id: '33333333-3333-4333-8333-333333333333',
  name: 'Cuadrilla',
  emoji: '👥',
};
const OTHER_GROUP = { id: '22222222-2222-4222-8222-222222222222', name: 'Otra', emoji: '🎉' };

const setCurrentGroup = vi.fn();
vi.mock('../stores/group', () => ({
  useGroupStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      currentGroup: { id: '33333333-3333-4333-8333-333333333333', name: 'Cuadrilla', emoji: '👥' },
      setCurrentGroup,
    }),
}));

vi.mock('../hooks/useGroups', () => ({
  useGroups: () => ({
    data: [{ id: '22222222-2222-4222-8222-222222222222', name: 'Otra', emoji: '🎉' }],
  }),
}));

const markAllRead = vi.fn();
const inbox = {
  items: [] as InboxNotification[],
  unreadCount: 0,
  isLoading: false,
  isError: false,
  hasNextPage: false,
  isFetchingNextPage: false,
  fetchNextPage: vi.fn(),
};
const invalidateQueries = vi.fn();

vi.mock('../hooks/useInbox', () => ({
  INBOX_QUERY_KEY: ['inbox'],
  useInbox: () => inbox,
  useMarkInboxRead: () => ({ mutate: markAllRead }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries }),
}));

import { InboxSheet, groupByDay, relativeTime } from './InboxSheet';

const NOW = new Date('2026-09-08T12:00:00.000Z');

function notice(over: Partial<InboxNotification> = {}): InboxNotification {
  return {
    id: 'n1',
    type: 'new_event',
    title: 'Nueva quedada',
    body: 'Ana ha creado "Cena"',
    data: { type: 'new_event', eventId: '11111111-1111-4111-8111-111111111111' },
    readAt: null,
    createdAt: NOW.toISOString(),
    ...over,
  };
}

describe('relativeTime', () => {
  it('reads as "now" under a minute', () => {
    expect(relativeTime(NOW.toISOString(), 'es-ES', 'ahora', NOW)).toBe('ahora');
  });

  it('counts minutes, hours and days', () => {
    const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

    expect(relativeTime(ago(5 * 60_000), 'en-GB', 'now', NOW)).toBe('5 minutes ago');
    expect(relativeTime(ago(3 * 3_600_000), 'en-GB', 'now', NOW)).toBe('3 hours ago');
    expect(relativeTime(ago(2 * 86_400_000), 'en-GB', 'now', NOW)).toBe('2 days ago');
  });

  it('says nothing for a timestamp it cannot read', () => {
    expect(relativeTime('not-a-date', 'es-ES', 'ahora', NOW)).toBe('');
  });
});

describe('groupByDay', () => {
  const labels = { today: 'Hoy', yesterday: 'Ayer' };

  it('labels today and yesterday, and dates the rest', () => {
    const days = groupByDay(
      [
        notice({ id: 'a', createdAt: NOW.toISOString() }),
        notice({ id: 'b', createdAt: new Date(NOW.getTime() - 86_400_000).toISOString() }),
        notice({ id: 'c', createdAt: new Date(NOW.getTime() - 5 * 86_400_000).toISOString() }),
      ],
      'es-ES',
      labels,
      NOW,
    );

    expect(days.map((d) => d.label)).toEqual(['Hoy', 'Ayer', '3 de septiembre']);
    expect(days.map((d) => d.items.length)).toEqual([1, 1, 1]);
  });

  it('keeps notices of the same day together, in the order they arrived', () => {
    const days = groupByDay([notice({ id: 'a' }), notice({ id: 'b' })], 'es-ES', labels, NOW);

    expect(days).toHaveLength(1);
    expect(days[0].items.map((n) => n.id)).toEqual(['a', 'b']);
  });
});

describe('InboxSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    inbox.items = [];
    inbox.unreadCount = 0;
    inbox.isLoading = false;
    inbox.hasNextPage = false;
    inbox.isFetchingNextPage = false;
    inbox.fetchNextPage = vi.fn();
  });

  it('shows an empty state when there is nothing', () => {
    render(<InboxSheet isOpen onClose={() => {}} />);

    expect(screen.getByText('inbox.empty.title')).toBeInTheDocument();
  });

  it('renders nothing while closed', () => {
    render(<InboxSheet isOpen={false} onClose={() => {}} />);

    expect(screen.queryByTestId('ion-modal')).not.toBeInTheDocument();
  });

  it('lists the notices with their title and body', () => {
    inbox.items = [notice()];

    render(<InboxSheet isOpen onClose={() => {}} />);

    expect(screen.getByText('Nueva quedada')).toBeInTheDocument();
    expect(screen.getByText('Ana ha creado "Cena"')).toBeInTheDocument();
  });

  it('marks the unread ones for a screen reader and leaves the read ones alone', () => {
    inbox.items = [notice({ id: 'a' }), notice({ id: 'b', readAt: '2026-09-08T11:00:00.000Z' })];

    render(<InboxSheet isOpen onClose={() => {}} />);

    expect(screen.getAllByText('inbox.unread')).toHaveLength(1);
  });

  it('marks everything read when it opens', async () => {
    inbox.unreadCount = 2;

    render(<InboxSheet isOpen onClose={() => {}} />);

    await waitFor(() => expect(markAllRead).toHaveBeenCalled());
  });

  it('does not touch the server when there is nothing unread', () => {
    render(<InboxSheet isOpen onClose={() => {}} />);

    expect(markAllRead).not.toHaveBeenCalled();
  });

  it('stays quiet while closed', () => {
    inbox.unreadCount = 2;

    render(<InboxSheet isOpen={false} onClose={() => {}} />);

    expect(markAllRead).not.toHaveBeenCalled();
  });

  it('refetches on close so the marks are gone next time', () => {
    const onClose = vi.fn();
    inbox.items = [notice()];

    render(<InboxSheet isOpen onClose={onClose} />);
    // Tapping a notice closes the sheet too, which is the close path the user takes.
    fireEvent.click(screen.getByText('Nueva quedada'));

    expect(onClose).toHaveBeenCalled();
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['inbox'] });
  });

  it('opens a notice where its push would have opened it', () => {
    inbox.items = [
      notice({
        data: {
          type: 'new_event',
          eventId: '11111111-1111-4111-8111-111111111111',
          groupId: '22222222-2222-4222-8222-222222222222',
        },
      }),
    ];

    render(<InboxSheet isOpen onClose={() => {}} />);
    fireEvent.click(screen.getByText('Nueva quedada'));

    expect(push).toHaveBeenCalledWith(
      '/tabs/plans?eventId=11111111-1111-4111-8111-111111111111&groupId=22222222-2222-4222-8222-222222222222',
    );
  });

  it('switches to the group the notice belongs to', () => {
    inbox.items = [notice({ data: { type: 'member_joined', groupId: OTHER_GROUP.id } })];

    render(<InboxSheet isOpen onClose={() => {}} />);
    fireEvent.click(screen.getByText('Nueva quedada'));

    expect(setCurrentGroup).toHaveBeenCalledWith(OTHER_GROUP);
    expect(push).toHaveBeenCalledWith(`/tabs/group/${OTHER_GROUP.id}`);
  });

  it('leaves the selection alone for a group you are not in', () => {
    inbox.items = [
      notice({ data: { type: 'member_joined', groupId: '44444444-4444-4444-8444-444444444444' } }),
    ];

    render(<InboxSheet isOpen onClose={() => {}} />);
    fireEvent.click(screen.getByText('Nueva quedada'));

    expect(setCurrentGroup).not.toHaveBeenCalled();
  });

  it('forgets the group you were thrown out of', () => {
    inbox.items = [notice({ data: { type: 'member_kicked', groupId: CURRENT_GROUP.id } })];

    render(<InboxSheet isOpen onClose={() => {}} />);
    fireEvent.click(screen.getByText('Nueva quedada'));

    expect(setCurrentGroup).toHaveBeenCalledWith(null);
    expect(push).toHaveBeenCalledWith('/tabs/group');
  });

  it('survives a notice with no payload at all', () => {
    inbox.items = [notice({ data: null })];

    render(<InboxSheet isOpen onClose={() => {}} />);
    fireEvent.click(screen.getByText('Nueva quedada'));

    expect(push).toHaveBeenCalledWith('/tabs/plans');
  });

  it('closes without navigating for a notice with no route', () => {
    const onClose = vi.fn();
    inbox.items = [notice({ data: { type: 'widget_refresh' } })];

    render(<InboxSheet isOpen onClose={onClose} />);
    fireEvent.click(screen.getByText('Nueva quedada'));

    expect(onClose).toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(setCurrentGroup).not.toHaveBeenCalled();
  });

  it('offers another page only when there is one', () => {
    inbox.items = [notice()];
    inbox.hasNextPage = true;

    render(<InboxSheet isOpen onClose={() => {}} />);
    fireEvent.click(screen.getByText('inbox.loadMore'));

    expect(inbox.fetchNextPage).toHaveBeenCalled();
  });

  it('shows a skeleton on the first load', () => {
    inbox.isLoading = true;

    render(<InboxSheet isOpen onClose={() => {}} />);

    expect(screen.queryByText('inbox.empty.title')).not.toBeInTheDocument();
  });
});
