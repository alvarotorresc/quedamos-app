import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, waitFor } from '@testing-library/react';
import { renderHookWithClient } from '../test/test-utils';
import { inboxService } from '../services/inbox';
import { supabase } from '../lib/supabase';
import { App as CapApp } from '@capacitor/app';
import { INBOX_QUERY_KEY, useInbox, useInboxSync, useMarkInboxRead } from './useInbox';

vi.mock('../services/inbox', () => ({
  inboxService: {
    list: vi.fn(),
    readAll: vi.fn().mockResolvedValue({ updated: 2 }),
    read: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock('../stores/auth', () => ({
  useAuthStore: vi.fn((selector: (state: { user: { id: string } | null }) => unknown) =>
    selector({ user: { id: 'user-1' } }),
  ),
}));

function notice(id: string, readAt: string | null = null) {
  return {
    id,
    type: 'new_event',
    title: 'Nueva quedada',
    body: 'Ana ha creado "Cena"',
    data: { type: 'new_event', eventId: 'e1' },
    readAt,
    createdAt: '2026-09-08T10:00:00.000Z',
  };
}

describe('useInbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(inboxService.list).mockResolvedValue({
      items: [notice('n1'), notice('n2', '2026-09-08T09:00:00.000Z')],
      nextCursor: 'n2',
      unreadCount: 1,
    });
  });

  it('flattens the pages and surfaces the unread counter', async () => {
    const { result } = renderHookWithClient(() => useInbox());

    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(result.current.items.map((n) => n.id)).toEqual(['n1', 'n2']);
    expect(result.current.unreadCount).toBe(1);
  });

  it('asks for the next page with the cursor it was handed', async () => {
    const { result } = renderHookWithClient(() => useInbox());

    await waitFor(() => expect(result.current.hasNextPage).toBe(true));

    vi.mocked(inboxService.list).mockResolvedValue({
      items: [notice('n3')],
      nextCursor: null,
      unreadCount: 1,
    });
    await act(async () => {
      await result.current.fetchNextPage();
    });

    expect(inboxService.list).toHaveBeenLastCalledWith({ cursor: 'n2' });
    await waitFor(() => expect(result.current.hasNextPage).toBe(false));
  });

  it('reports no unread notices before the first page arrives', () => {
    const { result } = renderHookWithClient(() => useInbox());

    expect(result.current.unreadCount).toBe(0);
    expect(result.current.items).toEqual([]);
  });
});

describe('useMarkInboxRead', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(inboxService.list).mockResolvedValue({
      items: [notice('n1')],
      nextCursor: null,
      unreadCount: 3,
    });
  });

  it('clears the counter without wiping the unread marks of the open sheet', async () => {
    const { result } = renderHookWithClient(() => ({
      inbox: useInbox(),
      markRead: useMarkInboxRead(),
    }));

    await waitFor(() => expect(result.current.inbox.unreadCount).toBe(3));

    await act(async () => {
      await result.current.markRead.mutateAsync();
    });

    expect(inboxService.readAll).toHaveBeenCalled();
    await waitFor(() => expect(result.current.inbox.unreadCount).toBe(0));
    // The rows keep their readAt so the sheet can still show which ones were new.
    expect(result.current.inbox.items[0].readAt).toBeNull();
  });
});

describe('useInboxSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('subscribes to the inserts of its own user only', () => {
    const on = vi.fn().mockReturnThis();
    const subscribe = vi.fn().mockReturnThis();
    vi.mocked(supabase.channel).mockReturnValue({
      on,
      subscribe,
    } as unknown as ReturnType<typeof supabase.channel>);

    renderHookWithClient(() => useInboxSync());

    expect(supabase.channel).toHaveBeenCalledWith('inbox:user-1');
    expect(on).toHaveBeenCalledWith(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: 'user_id=eq.user-1',
      },
      expect.any(Function),
    );
    expect(subscribe).toHaveBeenCalled();
  });

  it('refetches the inbox when a notice lands', async () => {
    let onInsert: (() => void) | undefined;
    const channel = { on: vi.fn(), subscribe: vi.fn() };
    channel.on.mockImplementation((_event: string, _filter: unknown, cb: () => void) => {
      onInsert = cb;
      return channel;
    });
    vi.mocked(supabase.channel).mockReturnValue(
      channel as unknown as ReturnType<typeof supabase.channel>,
    );

    const { queryClient } = renderHookWithClient(() => useInboxSync());
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    act(() => onInsert?.());

    expect(invalidate).toHaveBeenCalledWith({ queryKey: INBOX_QUERY_KEY });
  });

  it('drops the channel on unmount', () => {
    const channel = { on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() };
    vi.mocked(supabase.channel).mockReturnValue(
      channel as unknown as ReturnType<typeof supabase.channel>,
    );

    const { unmount } = renderHookWithClient(() => useInboxSync());
    unmount();

    expect(supabase.removeChannel).toHaveBeenCalledWith(channel);
  });

  it('shares one channel between the bells mounted on several tabs', () => {
    const channel = { on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() };
    vi.mocked(supabase.channel).mockReturnValue(
      channel as unknown as ReturnType<typeof supabase.channel>,
    );

    const first = renderHookWithClient(() => useInboxSync());
    const second = renderHookWithClient(() => useInboxSync());

    expect(supabase.channel).toHaveBeenCalledTimes(1);

    first.unmount();
    expect(supabase.removeChannel).not.toHaveBeenCalled();

    second.unmount();
    expect(supabase.removeChannel).toHaveBeenCalledWith(channel);
  });

  it('survives a realtime client that refuses to open a channel', () => {
    vi.mocked(supabase.channel).mockImplementation(() => {
      throw new Error('no socket');
    });

    expect(() => renderHookWithClient(() => useInboxSync())).not.toThrow();
  });

  it('refetches when the tab becomes visible again', () => {
    const channel = { on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() };
    vi.mocked(supabase.channel).mockReturnValue(
      channel as unknown as ReturnType<typeof supabase.channel>,
    );

    const { queryClient } = renderHookWithClient(() => useInboxSync());
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: INBOX_QUERY_KEY });
  });

  it('ignores the tab going away', () => {
    const channel = { on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() };
    vi.mocked(supabase.channel).mockReturnValue(
      channel as unknown as ReturnType<typeof supabase.channel>,
    );

    const { queryClient } = renderHookWithClient(() => useInboxSync());
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(invalidate).not.toHaveBeenCalled();
  });

  it('refetches when the native app comes back to the foreground', async () => {
    const channel = { on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() };
    vi.mocked(supabase.channel).mockReturnValue(
      channel as unknown as ReturnType<typeof supabase.channel>,
    );
    const remove = vi.fn();
    let onState: ((state: { isActive: boolean }) => void) | undefined;
    vi.mocked(CapApp.addListener).mockImplementation((_event: string, cb: unknown) => {
      onState = cb as (state: { isActive: boolean }) => void;
      return Promise.resolve({ remove }) as never;
    });

    const { queryClient, unmount } = renderHookWithClient(() => useInboxSync());
    await waitFor(() => expect(onState).toBeDefined());
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    act(() => onState?.({ isActive: true }));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: INBOX_QUERY_KEY });

    invalidate.mockClear();
    act(() => onState?.({ isActive: false }));
    expect(invalidate).not.toHaveBeenCalled();

    unmount();
    await waitFor(() => expect(remove).toHaveBeenCalled());
  });
});
