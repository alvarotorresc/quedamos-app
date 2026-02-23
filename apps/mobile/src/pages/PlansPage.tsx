import { useState, useMemo, useEffect, useRef } from 'react';
import { IonPage, IonContent, IonHeader, IonToolbar, IonTitle, IonSpinner } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useHistory, useLocation } from 'react-router-dom';
import { Avatar } from '../ui/Avatar';
import { useAuthStore } from '../stores/auth';
import { useGroupStore } from '../stores/group';
import { useGroups, useGroup } from '../hooks/useGroups';
import { useEvents } from '../hooks/useEvents';
import { useMyColor } from '../hooks/useMyColor';
import { useGroupSync } from '../hooks/useGroupSync';
import { apiDateToKey, formatDateKey } from '../lib/date-utils';
import { EventCard } from '../components/EventCard';
import type { Event } from '../services/events';

const MEMBER_COLORS = ['#60A5FA', '#F59E0B', '#F472B6', '#34D399', '#A78BFA', '#FB7185'];

export default function PlansPage() {
  const { t } = useTranslation();
  const history = useHistory();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const myColor = useMyColor();
  const [highlightEventId, setHighlightEventId] = useState<string | null>(null);
  const scrolledRef = useRef(false);

  // Group selection
  const { data: groups, isLoading: groupsLoading } = useGroups();
  const { currentGroup, setCurrentGroup, getPersistedGroupId } = useGroupStore();

  // Auto-select group on load
  useEffect(() => {
    if (!groups || groups.length === 0) return;
    if (currentGroup && groups.find((g) => g.id === currentGroup.id)) return;

    const persistedId = getPersistedGroupId();
    const match = persistedId ? groups.find((g) => g.id === persistedId) : null;
    setCurrentGroup(match ?? groups[0]);
  }, [groups, currentGroup, setCurrentGroup, getPersistedGroupId]);

  // Read eventId from push notification deep link
  const searchParams = new URLSearchParams(location.search);
  const targetEventId = searchParams.get('eventId');

  const groupId = currentGroup?.id ?? '';
  useGroupSync(groupId || undefined);

  // Group detail (for members)
  const { data: groupDetail } = useGroup(groupId);
  const members = groupDetail?.members ?? [];

  // Events data
  const { data: events, isLoading: eventsLoading } = useEvents(groupId);

  // Collapsible past
  const [showPast, setShowPast] = useState(false);

  // Member color map (userId -> color)
  const memberColorMap = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach((m, i) => {
      map.set(m.userId, MEMBER_COLORS[i % MEMBER_COLORS.length]);
    });
    return map;
  }, [members]);

  // Split events into upcoming and past
  const { upcoming, past } = useMemo(() => {
    if (!events) return { upcoming: [], past: [] };

    const today = formatDateKey(new Date());
    const up: Event[] = [];
    const pa: Event[] = [];

    for (const ev of events) {
      const dateKey = apiDateToKey(ev.date);
      if (dateKey >= today) {
        up.push(ev);
      } else {
        pa.push(ev);
      }
    }

    up.sort((a, b) => apiDateToKey(a.date).localeCompare(apiDateToKey(b.date)));
    pa.sort((a, b) => apiDateToKey(b.date).localeCompare(apiDateToKey(a.date)));

    return { upcoming: up, past: pa };
  }, [events]);

  // Scroll to event when navigated from push notification
  useEffect(() => {
    if (!targetEventId || scrolledRef.current || eventsLoading) return;

    // If the event is in past, expand past section first
    if (past.some((ev) => ev.id === targetEventId) && !showPast) {
      setShowPast(true);
    }

    // Wait for DOM to update then scroll
    setTimeout(() => {
      const el = document.getElementById(`event-${targetEventId}`);
      if (el) {
        scrolledRef.current = true;
        setHighlightEventId(targetEventId);
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => setHighlightEventId(null), 2500);
      }
    }, 300);
  }, [targetEventId, eventsLoading, past, showPast]);

  // Loading state
  if (groupsLoading) {
    return (
      <IonPage>
        <IonHeader className="ion-no-border">
          <IonToolbar className="py-2">
            <IonTitle>{t('plans.title')}</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <div className="flex items-center justify-center py-20">
            <IonSpinner name="crescent" className="text-primary w-6 h-6" />
          </div>
        </IonContent>
      </IonPage>
    );
  }

  // No groups state
  if (!groups || groups.length === 0) {
    return (
      <IonPage>
        <IonHeader className="ion-no-border">
          <IonToolbar className="py-2">
            <IonTitle>{t('plans.title')}</IonTitle>
            <div slot="end" className="pr-4">
              <Avatar name={user?.name ?? 'U'} color={myColor} size={32} onClick={() => history.push('/tabs/profile')} className="cursor-pointer" />
            </div>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <div className="text-center py-16 px-4">
            <div className="text-5xl mb-4">📋</div>
            <h2 className="text-lg font-bold text-text mb-1">
              {t('plans.noGroups')}
            </h2>
            <p className="text-sm text-text-muted mb-8">
              {t('plans.noGroupsSubtitle')}
            </p>
            <button
              onClick={() => history.push('/tabs/group')}
              className="px-5 py-2.5 bg-primary-dark text-white text-sm font-semibold rounded-btn border-none"
            >
              {t('plans.goToGroups')}
            </button>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  const hasEvents = upcoming.length > 0 || past.length > 0;

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar className="py-2">
          <IonTitle>{t('plans.title')}</IonTitle>
          <div slot="end" className="pr-4">
            <Avatar name={user?.name ?? 'U'} color={myColor} size={32} onClick={() => history.push('/tabs/profile')} className="cursor-pointer" />
          </div>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <div className="max-w-md mx-auto px-4 pt-2">
          {/* Group selector */}
          {groups.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2 no-scrollbar">
              {groups.map((g) => {
                const isActive = g.id === currentGroup?.id;
                return (
                  <button
                    key={g.id}
                    onClick={() => setCurrentGroup(g)}
                    className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border-none whitespace-nowrap"
                    style={{
                      background: isActive
                        ? 'rgba(37,99,235,0.12)'
                        : 'var(--app-bg-card)',
                      color: isActive ? '#60A5FA' : '#4B5C75',
                      border: `1px solid ${isActive ? 'rgba(96,165,250,0.2)' : 'var(--app-border)'}`,
                    }}
                  >
                    {g.emoji} {g.name}
                  </button>
                );
              })}
            </div>
          )}

          {/* Loading events */}
          {eventsLoading ? (
            <div className="flex items-center justify-center py-10">
              <IonSpinner name="crescent" className="text-primary w-5 h-5" />
            </div>
          ) : !hasEvents ? (
            /* Empty state */
            <div className="text-center py-16 px-4">
              <div className="text-4xl mb-3">📅</div>
              <p className="text-text-muted text-sm font-semibold">
                {t('plans.empty')}
              </p>
              <p className="text-text-dark text-xs mt-1">
                {t('plans.emptySubtitle')}
              </p>
              <button
                onClick={() => history.push('/tabs/calendar')}
                className="mt-4 px-5 py-2.5 bg-primary-dark text-white text-sm font-semibold rounded-btn border-none"
              >
                {t('plans.goToCalendar')}
              </button>
            </div>
          ) : (
            <>
              {/* Upcoming events */}
              {upcoming.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2">
                    {t('plans.upcoming')}
                  </h3>
                  <div className="space-y-2">
                    {upcoming.map((ev) => (
                      <div
                        key={ev.id}
                        id={`event-${ev.id}`}
                        className={`transition-all duration-500 rounded-[14px] ${highlightEventId === ev.id ? 'ring-2 ring-primary ring-offset-2 ring-offset-bg' : ''}`}
                      >
                        <EventCard
                          event={ev}
                          groupId={groupId}
                          memberColorMap={memberColorMap}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Past events */}
              {past.length > 0 && (
                <div className="mb-4">
                  <button
                    onClick={() => setShowPast(!showPast)}
                    className="flex items-center gap-1.5 text-xs font-bold text-text-dark uppercase tracking-wider mb-2 border-none bg-transparent"
                  >
                    <span
                      className="transition-transform text-[10px]"
                      style={{ transform: showPast ? 'rotate(90deg)' : 'rotate(0deg)' }}
                    >
                      ▶
                    </span>
                    {t('plans.past')} ({past.length})
                  </button>
                  {showPast && (
                    <div className="space-y-2 opacity-70">
                      {past.map((ev) => (
                        <div
                          key={ev.id}
                          id={`event-${ev.id}`}
                          className={`transition-all duration-500 rounded-[14px] ${highlightEventId === ev.id ? 'ring-2 ring-primary ring-offset-2 ring-offset-bg' : ''}`}
                        >
                          <EventCard
                            event={ev}
                            groupId={groupId}
                            memberColorMap={memberColorMap}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
}
