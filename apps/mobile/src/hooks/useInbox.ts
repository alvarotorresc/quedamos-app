import { useCallback, useEffect, useMemo } from 'react';
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { App as CapApp } from '@capacitor/app';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { inboxService, type InboxNotification, type InboxPage } from '../services/inbox';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/auth';

export const INBOX_QUERY_KEY = ['inbox'] as const;

interface UseInboxResult {
  items: InboxNotification[];
  /** Every unread notice of the user, not only the ones already loaded. */
  unreadCount: number;
  isLoading: boolean;
  isError: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => Promise<unknown>;
}

/**
 * The bandeja, paged. The cursor comes back inside each page, so «ver más» is a plain
 * `fetchNextPage` and nothing has to remember where it was.
 */
export function useInbox(): UseInboxResult {
  const query = useInfiniteQuery({
    queryKey: INBOX_QUERY_KEY,
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      inboxService.list(pageParam ? { cursor: pageParam } : {}),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: InboxPage) => lastPage.nextCursor ?? undefined,
  });

  const items = useMemo(() => query.data?.pages.flatMap((page) => page.items) ?? [], [query.data]);

  return {
    items,
    unreadCount: query.data?.pages[0]?.unreadCount ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
  };
}

/**
 * Marks everything read, which is what opening the bandeja does.
 *
 * The counter is zeroed straight in the cache instead of refetching: the sheet the user
 * is looking at keeps each notice's own `readAt`, so the marks that say «this one is
 * new» survive until it is closed, while the bell goes quiet immediately. The sheet
 * invalidates on close, and from then on everything reads as read.
 */
export function useMarkInboxRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => inboxService.readAll(),
    onSuccess: () => {
      queryClient.setQueryData<InfiniteData<InboxPage, string | undefined>>(
        INBOX_QUERY_KEY,
        (old) =>
          old ? { ...old, pages: old.pages.map((page) => ({ ...page, unreadCount: 0 })) } : old,
      );
    },
  });
}

/**
 * Keeps the bell honest while the app is open: a notice that lands on the server has to
 * show up without anybody pulling to refresh.
 *
 * Two independent channels, on purpose. Coming back to the foreground (the tab becoming
 * visible on web, `appStateChange` on Android) is the one that always works and covers
 * the case the user actually notices — tapping a push and finding the bell already
 * counting. The Realtime subscription is additive: if the table is not in the
 * publication yet, or the socket never authenticates, it simply never fires and nothing
 * else breaks.
 */
export function useInboxSync(): void {
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: INBOX_QUERY_KEY });
  }, [queryClient]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisibility);

    let removeNative: (() => void) | undefined;
    let cancelled = false;
    CapApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) refresh();
    })
      .then((handle) => {
        if (cancelled) handle.remove();
        else removeNative = () => handle.remove();
      })
      // No Capacitor bridge on the web build: the visibilitychange above is enough.
      .catch(() => {});

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      removeNative?.();
    };
  }, [refresh]);

  useEffect(() => {
    if (!userId) return;
    return subscribeToInbox(userId, refresh);
  }, [userId, refresh]);
}

interface InboxSubscription {
  userId: string;
  channel: RealtimeChannel | null;
  listeners: Set<() => void>;
}

let subscription: InboxSubscription | null = null;

/**
 * One Realtime channel for the whole app, no matter how many bells are mounted.
 *
 * Ionic keeps every visited tab alive, so Calendario, Planes and Grupo all hold a bell
 * at once; without this each of them would open its own socket channel for the same
 * rows. Same shape as `subscribeToGroup` in lib/group-sync.ts, minus the broadcast: the
 * rows are written by the API, so the client listens to the table instead.
 */
function subscribeToInbox(userId: string, onInsert: () => void): () => void {
  if (!subscription || subscription.userId !== userId) {
    if (subscription?.channel) supabase.removeChannel(subscription.channel);

    const entry: InboxSubscription = { userId, channel: null, listeners: new Set() };
    subscription = entry;

    try {
      const channel = supabase.channel(`inbox:${userId}`);
      channel.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => entry.listeners.forEach((listener) => listener()),
      );
      channel.subscribe();
      entry.channel = channel;
    } catch {
      // Realtime unavailable (no socket, table not published): the foreground refresh
      // above is the fallback, and a dead channel must not break the bell.
      entry.channel = null;
    }
  }

  const current = subscription;
  current.listeners.add(onInsert);

  return () => {
    current.listeners.delete(onInsert);
    if (current.listeners.size > 0) return;
    if (current.channel) supabase.removeChannel(current.channel);
    if (subscription === current) subscription = null;
  };
}
