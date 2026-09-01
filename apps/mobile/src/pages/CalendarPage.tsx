import { useState, useMemo } from 'react';
import { IonPage, IonContent, IonHeader, IonToolbar, IonTitle } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { Avatar } from '../ui/Avatar';
import { EmptyState, SkeletonCard, SegmentedPills } from '../ui';
import { useAuthStore } from '../stores/auth';
import { useGroupStore } from '../stores/group';
import { useGroups, useGroup } from '../hooks/useGroups';
import { useAvailability, useMyAvailability } from '../hooks/useAvailability';
import { useMyColor } from '../hooks/useMyColor';
import { useGroupWeather } from '../hooks/useWeather';
import { useScreenView } from '../hooks/useAnalytics';
import { useEvents } from '../hooks/useEvents';
import { useGroupSync } from '../hooks/useGroupSync';
import { usePollDeepLink } from '../hooks/usePollDeepLink';
import { useAutoSelectGroup } from '../hooks/useAutoSelectGroup';
import { formatDateKey, apiDateToKey, getWeekDays, weekOffsetOf } from '../lib/date-utils';
import type { Event } from '../services/events';
import { calculateTopDays, suggestBestTime } from '../lib/calendar-utils';
import { WeekView } from '../components/WeekView';
import { MonthView } from '../components/MonthView';
import { ListView } from '../components/ListView';
import { MonthSummary } from '../components/MonthSummary';
import { AvailabilityModal } from '../components/AvailabilityModal';
import { AvailabilityDetailModal } from '../components/AvailabilityDetailModal';
import { CreateEventModal } from '../components/CreateEventModal';
import { EventDetailModal } from '../components/EventDetailModal';
import { AskGroupSheet } from '../components/AskGroupSheet';
import { MazoGate } from '../components/MazoGate';
import type { EventPrefill } from '../components/CreateEventModal';
import type { Availability } from '../services/availability';
import type { WeatherData } from '../services/weather';
import { buildMemberColorMap } from '../lib/member-colors';

type CalView = 'week' | 'month' | 'list';

export default function CalendarPage() {
  useScreenView('Calendar');
  const { t, i18n } = useTranslation();
  const history = useHistory();
  const user = useAuthStore((s) => s.user);
  const myColor = useMyColor();

  // Group selection
  const { data: groups, isLoading: groupsLoading } = useGroups();
  const { currentGroup, setCurrentGroup } = useGroupStore();

  // Deep link from a push notification straight to a poll question (Task 7) — read once
  // from the URL. `groupId` is consumed by useAutoSelectGroup below (the only channel
  // that survives the service worker's notificationclick path, which has no access to
  // localStorage); `focusPollId`/`presetAnswer` are handed to MazoGate/Mazo, which also
  // clears everything via `clear` once truly done with them (see MazoGate for why).
  const {
    focusPollId,
    presetAnswer,
    groupId: deepLinkGroupId,
    clear: clearPollDeepLink,
  } = usePollDeepLink();

  // Auto-select group on load — deep-link groupId takes priority (fix round 1), then
  // whatever's already selected, then the persisted id, then the first group.
  useAutoSelectGroup(groups, deepLinkGroupId);

  const groupId = currentGroup?.id ?? '';
  useGroupSync(groupId || undefined);

  // Group detail (for members)
  const { data: groupDetail } = useGroup(groupId);
  const members = groupDetail?.members ?? [];

  // Availability data
  const { data: allAvailability, isLoading: availLoading } = useAvailability(groupId);
  const { data: myAvailability } = useMyAvailability(groupId);

  // Events data
  const { data: events } = useEvents(groupId);

  // Weather data
  const { data: weather } = useGroupWeather(groupId);

  // Calendar state
  const [calView, setCalView] = useState<CalView>('week');
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [showAvailModal, setShowAvailModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [showAskSheet, setShowAskSheet] = useState(false);
  const [askDay, setAskDay] = useState<Date | null>(null);
  const [createEventPrefill, setCreateEventPrefill] = useState<EventPrefill | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  // Member color map (userId -> color), by join order within the group
  const memberColorMap = useMemo(() => buildMemberColorMap(members), [members]);

  const locale = i18n.language === 'es' ? 'es-ES' : 'en-US';

  // Header month kicker — follows the active view's own navigation offset
  const headerMonthLabel = useMemo(() => {
    const base =
      calView === 'month'
        ? new Date(new Date().getFullYear(), new Date().getMonth() + monthOffset, 1)
        : calView === 'week'
          ? getWeekDays(new Date(), weekOffset)[0]
          : new Date();
    return base.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  }, [calView, weekOffset, monthOffset, locale]);

  // Index availability by date — use apiDateToKey to handle ISO dates safely
  const availabilityByDate = useMemo(() => {
    const map = new Map<string, Availability[]>();
    if (!allAvailability) return map;
    for (const a of allAvailability) {
      const key = apiDateToKey(a.date);
      const list = map.get(key) ?? [];
      list.push(a);
      map.set(key, list);
    }
    return map;
  }, [allAvailability]);

  // Index my availability by date
  const myAvailabilityByDate = useMemo(() => {
    const map = new Map<string, Availability>();
    if (!myAvailability) return map;
    for (const a of myAvailability) {
      map.set(apiDateToKey(a.date), a);
    }
    return map;
  }, [myAvailability]);

  // Index weather by date
  const weatherByDate = useMemo(() => {
    const map = new Map<string, WeatherData[]>();
    if (!weather) return map;
    for (const w of weather) {
      const list = map.get(w.date) ?? [];
      list.push(w);
      map.set(w.date, list);
    }
    return map;
  }, [weather]);

  // Index events by date
  const eventsByDate = useMemo(() => {
    const map = new Map<string, Event[]>();
    if (!events) return map;
    for (const ev of events) {
      if (ev.status === 'cancelled') continue;
      const key = apiDateToKey(ev.date);
      const list = map.get(key) ?? [];
      list.push(ev);
      map.set(key, list);
    }
    return map;
  }, [events]);

  // Top days calculation — days with most people available (future only)
  const today = formatDateKey(new Date());
  const topDays = useMemo(() => {
    return calculateTopDays(availabilityByDate, today, 2);
  }, [availabilityByDate, today]);

  const bestDay = topDays[0] ?? null;
  const secondBestDay = topDays[1] ?? null;

  // Existing availability for selected day (for modal)
  const existingAvail = selectedDay
    ? (myAvailabilityByDate.get(formatDateKey(selectedDay)) ?? null)
    : null;

  const handleMarkAvailability = () => {
    if (!selectedDay) setSelectedDay(new Date());
    setShowAvailModal(true);
  };

  const handleAskGroup = (day: Date) => {
    // Same guard as handleCreateEvent below: a poll for a past day would push a
    // notification for a question usePendingQuestions filters out for everyone
    // (it only surfaces polls with date >= today), so it would be unanswerable
    // and invisible — and it would still occupy that day+slot's unique-open-poll
    // slot (uniqueness in polls.service.ts is scoped to groupId+date+slot, not
    // the whole day).
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (day < today) return;

    setAskDay(day);
    setShowAskSheet(true);
  };

  const handleCreateEventDirect = () => {
    setCreateEventPrefill(null);
    setShowCreateEvent(true);
  };

  const handleCreateEvent = (day: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (day < today) return;

    const dateKey = formatDateKey(day);
    const dayAvail = availabilityByDate.get(dateKey) ?? [];

    const availMembers = dayAvail.map((a) => ({
      userId: a.userId,
      name: a.user?.name ?? '?',
      color: memberColorMap.get(a.userId) ?? '#60A5FA',
    }));

    const suggestion = suggestBestTime(dayAvail);

    const dateLabel = day.toLocaleDateString(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    const weekday = day.toLocaleDateString(locale, { weekday: 'long' });

    setCreateEventPrefill({
      date: dateKey,
      dateLabel,
      weekday,
      suggestedTime: suggestion?.time ?? null,
      suggestedSlot: suggestion?.slot ?? null,
      availableMembers: availMembers,
      availableCount: dayAvail.length,
      weather: weatherByDate.get(dateKey) ?? null,
    });
    setShowCreateEvent(true);
  };

  // Loading state
  if (groupsLoading) {
    return (
      <IonPage>
        <IonHeader className="ion-no-border">
          <IonToolbar className="py-2">
            <IonTitle>{t('calendar.title')}</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <div className="max-w-md mx-auto px-4 pt-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
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
            <IonTitle>{t('calendar.title')}</IonTitle>
            <div slot="end" className="pr-4">
              <Avatar
                name={user?.name ?? 'U'}
                color={myColor}
                size={32}
                onClick={() => history.push('/tabs/profile')}
                className="cursor-pointer"
              />
            </div>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <div className="text-center py-16 px-4">
            <div className="text-5xl mb-4">📆</div>
            <h2 className="text-lg font-bold text-text mb-1">{t('calendar.noGroups')}</h2>
            <p className="text-sm text-text-muted mb-8">{t('calendar.noGroupsSubtitle')}</p>
            <button
              onClick={() => history.push('/tabs/group')}
              className="px-5 py-2.5 bg-primary-dark text-white text-sm font-semibold rounded-btn border-none"
            >
              {t('calendar.goToGroups')}
            </button>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar className="py-2">
          <IonTitle>{t('calendar.title')}</IonTitle>
          <div slot="end" className="pr-4 flex items-center gap-3">
            <button
              onClick={handleCreateEventDirect}
              className="w-8 h-8 flex items-center justify-center rounded-full border-none text-primary text-xl font-light leading-none"
              style={{ background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)' }}
              aria-label={t('plans.create.title')}
            >
              +
            </button>
            <Avatar
              name={user?.name ?? 'U'}
              color={myColor}
              size={32}
              onClick={() => history.push('/tabs/profile')}
              className="cursor-pointer"
            />
          </div>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <div className="max-w-md mx-auto px-4 pt-2">
          {/* Page header */}
          <div className="mb-3">
            <h1 className="text-[27px] font-extrabold tracking-tight text-text">
              {t('calendar.title')}
            </h1>
            <p className="font-mono text-[10px] tracking-[0.16em] uppercase text-text-muted">
              {headerMonthLabel}
            </p>
          </div>

          {/* Group selector */}
          {groups.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2 no-scrollbar">
              {groups.map((g) => {
                const isActive = g.id === currentGroup?.id;
                return (
                  <button
                    key={g.id}
                    onClick={() => {
                      setCurrentGroup(g);
                      setSelectedDay(null);
                      setWeekOffset(0);
                      setMonthOffset(0);
                    }}
                    className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border-none whitespace-nowrap"
                    style={{
                      background: isActive
                        ? 'color-mix(in srgb, var(--app-primary) 12%, transparent)'
                        : 'var(--app-bg-card)',
                      color: isActive ? 'var(--app-text)' : 'var(--app-text-dark)',
                      border: `1px solid ${isActive ? 'color-mix(in srgb, var(--app-primary) 20%, transparent)' : 'var(--app-border)'}`,
                    }}
                  >
                    {g.emoji} {g.name}
                  </button>
                );
              })}
            </div>
          )}

          {/* View toggle */}
          <div className="mb-3">
            <SegmentedPills
              options={[
                { value: 'week', label: t('calendar.week') },
                { value: 'month', label: t('calendar.month') },
                { value: 'list', label: t('calendar.list') },
              ]}
              value={calView}
              onChange={(v) => {
                setCalView(v);
                setSelectedDay(null);
              }}
            />
          </div>

          {/* Loading availability */}
          {availLoading ? (
            <div className="py-4">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : (
            <>
              {/* Calendar view */}
              {calView === 'week' && (
                <WeekView
                  weekOffset={weekOffset}
                  onWeekChange={setWeekOffset}
                  selectedDay={selectedDay}
                  onSelectDay={setSelectedDay}
                  availabilityByDate={availabilityByDate}
                  myAvailabilityByDate={myAvailabilityByDate}
                  memberColorMap={memberColorMap}
                  totalMembers={members.length}
                  bestDayKey={bestDay?.dateKey ?? null}
                  secondBestDayKey={secondBestDay?.dateKey ?? null}
                  onMarkAvailability={handleMarkAvailability}
                  onCreateEvent={handleCreateEvent}
                  onViewDetail={(day) => {
                    setSelectedDay(day);
                    setShowDetailModal(true);
                  }}
                  weatherByDate={weatherByDate}
                  eventsByDate={eventsByDate}
                  onEventClick={(ev) => setSelectedEvent(ev)}
                  onAskGroup={handleAskGroup}
                />
              )}
              {calView === 'month' && (
                <MonthView
                  monthOffset={monthOffset}
                  onMonthChange={setMonthOffset}
                  selectedDay={selectedDay}
                  onSelectDay={setSelectedDay}
                  availabilityByDate={availabilityByDate}
                  myAvailabilityByDate={myAvailabilityByDate}
                  memberColorMap={memberColorMap}
                  totalMembers={members.length}
                  onMarkAvailability={handleMarkAvailability}
                  onCreateEvent={handleCreateEvent}
                  onViewDetail={(day) => {
                    setSelectedDay(day);
                    setShowDetailModal(true);
                  }}
                  weatherByDate={weatherByDate}
                  eventsByDate={eventsByDate}
                  onEventClick={(ev) => setSelectedEvent(ev)}
                />
              )}
              {calView === 'list' && (
                <ListView
                  availabilityByDate={availabilityByDate}
                  memberColorMap={memberColorMap}
                  totalMembers={members.length}
                  bestDayKey={bestDay?.dateKey ?? null}
                  secondBestDayKey={secondBestDay?.dateKey ?? null}
                  onSelectDay={(day) => {
                    setSelectedDay(day);
                    setWeekOffset(weekOffsetOf(day));
                    setCalView('week');
                  }}
                  weatherByDate={weatherByDate}
                />
              )}

              {/* Empty state — no one has marked availability yet */}
              {availabilityByDate.size === 0 && (
                <EmptyState
                  emoji="📅"
                  title={t('calendar.emptyTitle')}
                  description={t('calendar.emptyDescription')}
                  action={t('calendar.emptyAction')}
                  onAction={handleMarkAvailability}
                />
              )}

              {/* Bottom section — varies by view */}
              {calView === 'month' && (
                <MonthSummary
                  monthOffset={monthOffset}
                  availabilityByDate={availabilityByDate}
                  totalMembers={members.length}
                />
              )}
            </>
          )}
        </div>

        {/* Availability detail modal */}
        <AvailabilityDetailModal
          isOpen={showDetailModal}
          onClose={() => setShowDetailModal(false)}
          selectedDay={selectedDay}
          availabilities={
            selectedDay ? (availabilityByDate.get(formatDateKey(selectedDay)) ?? []) : []
          }
          memberColorMap={memberColorMap}
          onMarkAvailability={handleMarkAvailability}
        />

        {/* Availability modal */}
        <AvailabilityModal
          isOpen={showAvailModal}
          onClose={() => setShowAvailModal(false)}
          selectedDay={selectedDay}
          groupId={groupId}
          existingAvailability={existingAvail}
        />

        {/* Create event modal */}
        <CreateEventModal
          isOpen={showCreateEvent}
          onClose={() => setShowCreateEvent(false)}
          groupId={groupId}
          prefill={createEventPrefill}
          weatherByDate={weatherByDate}
        />

        {/* Event detail modal */}
        <EventDetailModal
          isOpen={!!selectedEvent}
          onClose={() => setSelectedEvent(null)}
          event={selectedEvent}
          memberColorMap={memberColorMap}
        />

        {/* Ask-the-group sheet */}
        <AskGroupSheet
          isOpen={showAskSheet}
          onClose={() => setShowAskSheet(false)}
          groupId={groupId}
          day={askDay}
        />
      </IonContent>

      {/* El mazo — entry overlay for pending questions. MazoGate owns the open/dismiss
          latch itself (see MazoGate.tsx for why it can't be a live-data condition here). */}
      <MazoGate
        groupId={groupId}
        focusPollId={focusPollId}
        presetAnswer={presetAnswer}
        onDismiss={clearPollDeepLink}
      />
    </IonPage>
  );
}
