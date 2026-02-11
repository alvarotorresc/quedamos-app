import { useState, useMemo, useEffect } from 'react';
import { IonPage, IonContent, IonHeader, IonToolbar, IonTitle, IonSpinner } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { Avatar } from '../ui/Avatar';
import { useAuthStore } from '../stores/auth';
import { useGroupStore } from '../stores/group';
import { useGroups, useGroup } from '../hooks/useGroups';
import { useAvailability, useMyAvailability } from '../hooks/useAvailability';
import { useMyColor } from '../hooks/useMyColor';
import { formatDateKey, apiDateToKey, parseDateKey } from '../lib/date-utils';
import { WeekView } from '../components/WeekView';
import { MonthView } from '../components/MonthView';
import { ListView } from '../components/ListView';
import { BestDayBanner } from '../components/BestDayBanner';
import { MonthSummary } from '../components/MonthSummary';
import { AvailabilityModal } from '../components/AvailabilityModal';
import { CreateEventModal } from '../components/CreateEventModal';
import type { EventPrefill } from '../components/CreateEventModal';
import type { Availability } from '../services/availability';

function suggestBestTime(availabilities: Availability[]): { time: string; slot: string } | null {
  if (availabilities.length === 0) return null;

  const votes = { morning: 0, afternoon: 0, night: 0 };

  for (const a of availabilities) {
    if (a.type === 'day') {
      votes.morning++;
      votes.afternoon++;
      votes.night++;
    } else if (a.type === 'slots' && a.slots) {
      for (const slot of a.slots) {
        if (slot === 'Mañana') votes.morning++;
        else if (slot === 'Tarde') votes.afternoon++;
        else if (slot === 'Noche') votes.night++;
      }
    } else if (a.type === 'range' && a.startTime && a.endTime) {
      const start = parseInt(a.startTime.split(':')[0]);
      const end = parseInt(a.endTime.split(':')[0]);
      if (start <= 13 && end >= 8) votes.morning++;
      if (start <= 19 && end >= 14) votes.afternoon++;
      if (end >= 20 || start >= 20) votes.night++;
    }
  }

  const entries = Object.entries(votes).sort(([, a], [, b]) => b - a);
  if (entries[0][1] === 0) return null;

  switch (entries[0][0]) {
    case 'morning':
      return { time: '10:00', slot: 'morning' };
    case 'afternoon':
      return { time: '17:00', slot: 'afternoon' };
    case 'night':
      return { time: '21:00', slot: 'night' };
    default:
      return null;
  }
}

const MEMBER_COLORS = ['#60A5FA', '#F59E0B', '#F472B6', '#34D399', '#A78BFA', '#FB7185'];

type CalView = 'week' | 'month' | 'list';

export default function CalendarPage() {
  const { t, i18n } = useTranslation();
  const history = useHistory();
  const user = useAuthStore((s) => s.user);
  const myColor = useMyColor();

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

  const groupId = currentGroup?.id ?? '';

  // Group detail (for members)
  const { data: groupDetail } = useGroup(groupId);
  const members = groupDetail?.members ?? [];

  // Availability data
  const { data: allAvailability, isLoading: availLoading } = useAvailability(groupId);
  const { data: myAvailability } = useMyAvailability(groupId);

  // Calendar state
  const [calView, setCalView] = useState<CalView>('week');
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [showAvailModal, setShowAvailModal] = useState(false);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [createEventPrefill, setCreateEventPrefill] = useState<EventPrefill | null>(null);

  // Member color map (userId -> color)
  const memberColorMap = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach((m, i) => {
      map.set(m.userId, MEMBER_COLORS[i % MEMBER_COLORS.length]);
    });
    return map;
  }, [members]);

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

  // Best day calculation — day with most people available (future only)
  const bestDay = useMemo(() => {
    if (!allAvailability || availabilityByDate.size === 0) return null;

    const today = formatDateKey(new Date());
    let best: { dateKey: string; count: number } | null = null;

    for (const [dateKey, avails] of availabilityByDate) {
      if (dateKey < today) continue;
      if (!best || avails.length > best.count) {
        best = { dateKey, count: avails.length };
      }
    }
    return best;
  }, [allAvailability, availabilityByDate]);

  // Existing availability for selected day (for modal)
  const existingAvail = selectedDay
    ? myAvailabilityByDate.get(formatDateKey(selectedDay)) ?? null
    : null;

  const handleMarkAvailability = () => {
    setShowAvailModal(true);
  };

  const handleCreateEvent = (day: Date) => {
    const dateKey = formatDateKey(day);
    const dayAvail = availabilityByDate.get(dateKey) ?? [];

    const availMembers = dayAvail.map((a) => ({
      name: a.user?.name ?? '?',
      color: memberColorMap.get(a.userId) ?? '#60A5FA',
    }));

    const suggestion = suggestBestTime(dayAvail);

    const locale = i18n.language === 'es' ? 'es-ES' : 'en-US';
    const dateLabel = day.toLocaleDateString(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });

    setCreateEventPrefill({
      date: dateKey,
      dateLabel,
      suggestedTime: suggestion?.time ?? null,
      suggestedSlot: suggestion?.slot ?? null,
      availableMembers: availMembers,
      availableCount: dayAvail.length,
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
            <IonTitle>{t('calendar.title')}</IonTitle>
            <div slot="end" className="pr-4">
              <Avatar name={user?.name ?? 'U'} color={myColor} size={32} />
            </div>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <div className="text-center py-20 px-4">
            <p className="text-text-muted text-base font-semibold">
              {t('calendar.noGroups')}
            </p>
            <p className="text-text-dark text-sm mt-1">
              {t('calendar.noGroupsSubtitle')}
            </p>
            <button
              onClick={() => history.push('/tabs/group')}
              className="mt-4 px-5 py-2.5 bg-primary-dark text-white text-sm font-semibold rounded-btn border-none"
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
          <div slot="end" className="pr-4">
            <Avatar name={user?.name ?? 'U'} color={myColor} size={32} />
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
                    onClick={() => {
                      setCurrentGroup(g);
                      setSelectedDay(null);
                      setWeekOffset(0);
                      setMonthOffset(0);
                    }}
                    className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border-none whitespace-nowrap"
                    style={{
                      background: isActive
                        ? 'rgba(37,99,235,0.12)'
                        : 'rgba(255,255,255,0.025)',
                      color: isActive ? '#60A5FA' : '#4B5C75',
                      border: `1px solid ${isActive ? 'rgba(96,165,250,0.2)' : 'rgba(255,255,255,0.05)'}`,
                    }}
                  >
                    {g.emoji} {g.name}
                  </button>
                );
              })}
            </div>
          )}

          {/* View toggle */}
          <div className="flex gap-1 mb-3">
            {(['week', 'month', 'list'] as const).map((view) => (
              <button
                key={view}
                onClick={() => {
                  setCalView(view);
                  setSelectedDay(null);
                }}
                className="flex-1 py-2 rounded-btn text-xs font-semibold border-none"
                style={{
                  background:
                    calView === view
                      ? 'rgba(37,99,235,0.12)'
                      : 'rgba(255,255,255,0.025)',
                  color: calView === view ? '#60A5FA' : '#4B5C75',
                }}
              >
                {t(`calendar.${view}`)}
              </button>
            ))}
          </div>

          {/* Loading availability */}
          {availLoading ? (
            <div className="flex items-center justify-center py-10">
              <IonSpinner name="crescent" className="text-primary w-5 h-5" />
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
                  onMarkAvailability={handleMarkAvailability}
                  onCreateEvent={handleCreateEvent}
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
                />
              )}
              {calView === 'list' && (
                <ListView
                  availabilityByDate={availabilityByDate}
                  memberColorMap={memberColorMap}
                  totalMembers={members.length}
                  bestDayKey={bestDay?.dateKey ?? null}
                  onSelectDay={(day) => {
                    setSelectedDay(day);
                    setCalView('week');
                  }}
                />
              )}

              {/* Bottom section — varies by view */}
              {calView === 'week' && bestDay && (
                <div className="mt-6">
                  <BestDayBanner
                    dateKey={bestDay.dateKey}
                    availableCount={bestDay.count}
                    totalMembers={members.length}
                    onClick={() => handleCreateEvent(parseDateKey(bestDay.dateKey))}
                  />
                </div>
              )}
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
        />
      </IonContent>
    </IonPage>
  );
}
