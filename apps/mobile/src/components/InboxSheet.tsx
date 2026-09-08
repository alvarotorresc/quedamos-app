import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { SkeletonCard } from '../ui/SkeletonCard';
import { INBOX_QUERY_KEY, useInbox, useMarkInboxRead } from '../hooks/useInbox';
import { useGroups } from '../hooks/useGroups';
import { useGroupStore } from '../stores/group';
import { resolvePushRoute } from '../lib/push-routes';
import { formatDateKey } from '../lib/date-utils';
import type { InboxNotification } from '../services/inbox';

interface InboxSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface InboxDay {
  key: string;
  label: string;
  items: InboxNotification[];
}

interface DayLabels {
  today: string;
  yesterday: string;
}

/**
 * «hace 5 min», «hace 2 h», «ayer». Intl does the wording in the reader's language;
 * anything under a minute reads as «ahora» instead of «este minuto», which is what
 * `Intl.RelativeTimeFormat` says for a zero and nobody writes.
 */
export function relativeTime(
  iso: string,
  locale: string,
  nowLabel: string,
  now: Date = new Date(),
): string {
  const diff = new Date(iso).getTime() - now.getTime();
  if (Number.isNaN(diff)) return '';
  if (Math.abs(diff) < 60_000) return nowLabel;

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const minutes = Math.round(diff / 60_000);
  if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute');

  const hours = Math.round(diff / 3_600_000);
  if (Math.abs(hours) < 24) return rtf.format(hours, 'hour');

  return rtf.format(Math.round(diff / 86_400_000), 'day');
}

/**
 * Splits the list into the days it happened on, keeping the order it arrived in (the
 * API already sorts it newest first), so the sheet reads as a diary rather than as a
 * flat list of timestamps.
 */
export function groupByDay(
  items: InboxNotification[],
  locale: string,
  labels: DayLabels,
  now: Date = new Date(),
): InboxDay[] {
  const todayKey = formatDateKey(now);
  const yesterdayKey = formatDateKey(new Date(now.getTime() - 86_400_000));

  const days: InboxDay[] = [];
  const byKey = new Map<string, InboxDay>();

  for (const item of items) {
    const date = new Date(item.createdAt);
    const key = formatDateKey(date);
    let day = byKey.get(key);
    if (!day) {
      const label =
        key === todayKey
          ? labels.today
          : key === yesterdayKey
            ? labels.yesterday
            : date.toLocaleDateString(locale, { day: 'numeric', month: 'long' });
      day = { key, label, items: [] };
      byKey.set(key, day);
      days.push(day);
    }
    day.items.push(item);
  }

  return days;
}

/**
 * La bandeja. Opening it marks everything read — the counter goes to zero at once while
 * each notice keeps its own mark, so you can still see which ones were new — and
 * closing it refetches, so the next time everything reads as read.
 */
export function InboxSheet({ isOpen, onClose }: InboxSheetProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'es' ? 'es-ES' : 'en-GB';
  const history = useHistory();
  const queryClient = useQueryClient();

  const { items, unreadCount, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useInbox();
  const markAllRead = useMarkInboxRead();
  const markAllReadMutate = markAllRead.mutate;

  const { data: groups } = useGroups();
  const currentGroup = useGroupStore((s) => s.currentGroup);
  const setCurrentGroup = useGroupStore((s) => s.setCurrentGroup);

  // Runs again as soon as a first page with unread notices arrives, so opening the
  // sheet before the list loads still clears the bell.
  useEffect(() => {
    if (!isOpen || unreadCount === 0) return;
    markAllReadMutate();
  }, [isOpen, unreadCount, markAllReadMutate]);

  const days = useMemo(
    () =>
      groupByDay(items, locale, {
        today: t('inbox.today'),
        yesterday: t('inbox.yesterday'),
      }),
    [items, locale, t],
  );

  const handleClose = () => {
    onClose();
    queryClient.invalidateQueries({ queryKey: INBOX_QUERY_KEY });
  };

  /**
   * Same table the push tap uses, so a notice opens the same screen whether it was read
   * from the system tray or from here. The group is switched through the store instead
   * of writing its localStorage key by hand — the store owns that key.
   */
  const handleOpen = (notification: InboxNotification) => {
    const route = resolvePushRoute(notification.data ?? {});

    if (route.persistGroupId) {
      const match = groups?.find((g) => g.id === route.persistGroupId);
      if (match) setCurrentGroup(match);
    } else if (route.forgetGroupId && currentGroup?.id === route.forgetGroupId) {
      setCurrentGroup(null);
    }

    handleClose();
    history.push(route.url);
  };

  return (
    <Sheet isOpen={isOpen} onClose={handleClose} title={t('inbox.title')}>
      {isLoading ? (
        <>
          <SkeletonCard />
          <SkeletonCard />
        </>
      ) : items.length === 0 ? (
        <EmptyState
          emoji="🔔"
          title={t('inbox.empty.title')}
          description={t('inbox.empty.description')}
        />
      ) : (
        <>
          {days.map((day) => (
            <div key={day.key} className="mb-4 last:mb-0">
              <p className="font-mono text-[10px] tracking-[0.16em] uppercase text-text-muted mb-1.5">
                {day.label}
              </p>
              <div className="flex flex-col gap-1.5">
                {day.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleOpen(item)}
                    className="w-full text-left bg-bg-glass border border-subtle rounded-card p-3 flex gap-2.5 items-start"
                  >
                    <span
                      aria-hidden="true"
                      className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                        item.readAt ? 'bg-transparent' : 'bg-primary-solid'
                      }`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className="text-[13px] font-bold text-text truncate">
                          {item.title}
                        </span>
                        <span className="ml-auto shrink-0 font-mono text-[10px] text-text-dark">
                          {relativeTime(item.createdAt, locale, t('inbox.now'))}
                        </span>
                      </span>
                      <span className="block text-xs text-text-muted mt-0.5">{item.body}</span>
                      {!item.readAt && <span className="sr-only">{t('inbox.unread')}</span>}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}

          {hasNextPage && (
            <div className="pt-1 pb-1 flex justify-center">
              <Button
                variant="secondary"
                size="sm"
                loading={isFetchingNextPage}
                onClick={() => fetchNextPage()}
              >
                {t('inbox.loadMore')}
              </Button>
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}

export default InboxSheet;
