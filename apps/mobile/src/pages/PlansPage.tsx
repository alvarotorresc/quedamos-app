import { useState, useMemo, useEffect, useRef } from 'react';
import {
  IonPage,
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonSpinner,
  IonAlert,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useHistory, useLocation } from 'react-router-dom';
import { Avatar } from '../ui/Avatar';
import { useAuthStore } from '../stores/auth';
import { useGroupStore } from '../stores/group';
import { useGroups, useGroup } from '../hooks/useGroups';
import { useEvents, useDeleteEvent, useCancelEvent } from '../hooks/useEvents';
import { useProposals, useVoteProposal, useCloseProposal } from '../hooks/useProposals';
import { useMyColor } from '../hooks/useMyColor';
import { useGroupSync } from '../hooks/useGroupSync';
import { useGroupWeather } from '../hooks/useWeather';
import { apiDateToKey, formatDateKey } from '../lib/date-utils';
import type { WeatherData } from '../services/weather';
import { EventCard } from '../components/EventCard';
import { EditEventModal } from '../components/EditEventModal';
import { ProposalCard } from '../components/ProposalCard';
import { CreateProposalModal } from '../components/CreateProposalModal';
import { EditProposalModal } from '../components/EditProposalModal';
import { ConvertProposalModal } from '../components/ConvertProposalModal';
import type { Event } from '../services/events';
import type { Proposal } from '../services/proposals';

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

  // Weather data
  const { data: weather } = useGroupWeather(groupId);
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

  // Edit/delete/cancel state
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deletingEvent, setDeletingEvent] = useState<Event | null>(null);
  const [cancellingEvent, setCancellingEvent] = useState<Event | null>(null);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  const [cancellingEventId, setCancellingEventId] = useState<string | null>(null);
  const deleteEvent = useDeleteEvent(groupId);
  const cancelEvent = useCancelEvent(groupId);

  // Proposals state
  const { data: proposals } = useProposals(groupId);
  const voteProposal = useVoteProposal(groupId);
  const closeProposal = useCloseProposal(groupId);
  const [votingProposalId, setVotingProposalId] = useState<string | null>(null);
  const [closingProposalId, setClosingProposalId] = useState<string | null>(null);
  const [showCreateProposal, setShowCreateProposal] = useState(false);
  const [editingProposal, setEditingProposal] = useState<Proposal | null>(null);
  const [showEditProposalModal, setShowEditProposalModal] = useState(false);
  const [convertingProposal, setConvertingProposal] = useState<Proposal | null>(null);

  // Tab state
  type PlansTab = 'plans' | 'proposals';
  const [activeTab, setActiveTab] = useState<PlansTab>('plans');

  // Collapsible sections
  const [showPast, setShowPast] = useState(false);
  const [showClosedProposals, setShowClosedProposals] = useState(false);

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
            <div className="text-5xl mb-4">📋</div>
            <h2 className="text-lg font-bold text-text mb-1">{t('plans.noGroups')}</h2>
            <p className="text-sm text-text-muted mb-8">{t('plans.noGroupsSubtitle')}</p>
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

  const handleEdit = (ev: Event) => {
    setEditingEvent(ev);
    setShowEditModal(true);
  };

  const handleDelete = (ev: Event) => {
    setDeletingEvent(ev);
  };

  const handleCancel = (ev: Event) => {
    setCancellingEvent(ev);
  };

  const handleVote = (proposalId: string, vote: 'yes' | 'no') => {
    setVotingProposalId(proposalId);
    voteProposal.mutate(
      { proposalId, data: { vote } },
      {
        onSettled: () => setVotingProposalId(null),
      },
    );
  };

  const handleCloseProposal = (proposalId: string) => {
    setClosingProposalId(proposalId);
    closeProposal.mutate(proposalId, {
      onSettled: () => setClosingProposalId(null),
    });
  };

  const handleEditProposal = (proposal: Proposal) => {
    setEditingProposal(proposal);
    setShowEditProposalModal(true);
  };

  const openProposals = proposals?.filter((p) => p.status === 'open') ?? [];
  const closedOrConvertedProposals = proposals?.filter((p) => p.status !== 'open') ?? [];
  const allProposals = [...openProposals, ...closedOrConvertedProposals];
  const hasEvents = upcoming.length > 0 || past.length > 0;
  const hasProposals = allProposals.length > 0;
  const hasContent = activeTab === 'plans' ? hasEvents : hasProposals;

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar className="py-2">
          <IonTitle>{t('plans.title')}</IonTitle>
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
                      background: isActive ? 'rgba(37,99,235,0.12)' : 'var(--app-bg-card)',
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

          {/* Tab bar */}
          <div className="flex gap-1 mb-3">
            {(['plans', 'proposals'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="flex-1 py-2 rounded-btn text-xs font-semibold border-none"
                style={{
                  background: activeTab === tab ? 'rgba(37,99,235,0.12)' : 'var(--app-bg-card)',
                  color: activeTab === tab ? '#60A5FA' : '#4B5C75',
                }}
              >
                {t(`plans.tabs.${tab}`)}
              </button>
            ))}
          </div>

          {/* Loading events */}
          {eventsLoading ? (
            <div className="flex items-center justify-center py-10">
              <IonSpinner name="crescent" className="text-primary w-5 h-5" />
            </div>
          ) : !hasContent ? (
            /* Empty state */
            <div className="text-center py-16 px-4">
              <div className="text-4xl mb-3">{activeTab === 'plans' ? '📅' : '💡'}</div>
              <p className="text-text-muted text-sm font-semibold">
                {activeTab === 'plans' ? t('plans.empty') : t('proposals.empty')}
              </p>
              {activeTab === 'plans' ? (
                <>
                  <p className="text-text-dark text-xs mt-1">{t('plans.emptySubtitle')}</p>
                  <button
                    onClick={() => history.push('/tabs/calendar')}
                    className="mt-4 px-5 py-2.5 bg-primary-dark text-white text-sm font-semibold rounded-btn border-none"
                  >
                    {t('plans.goToCalendar')}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowCreateProposal(true)}
                  className="mt-4 px-5 py-2.5 bg-primary-dark text-white text-sm font-semibold rounded-btn border-none"
                >
                  + {t('proposals.create')}
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Tab: Quedadas */}
              {activeTab === 'plans' && (
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
                              weather={weatherByDate.get(apiDateToKey(ev.date))}
                              onEdit={handleEdit}
                              onDelete={handleDelete}
                              onCancel={handleCancel}
                              isDeleting={deletingEventId === ev.id}
                              isCancelling={cancellingEventId === ev.id}
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
                                weather={weatherByDate.get(apiDateToKey(ev.date))}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Tab: Propuestas */}
              {activeTab === 'proposals' && (
                <>
                  {/* New proposal button */}
                  <div className="flex justify-end mb-3">
                    <button
                      onClick={() => setShowCreateProposal(true)}
                      className="px-3 py-1.5 rounded-[10px] text-[11px] font-semibold border-none"
                      style={{
                        background: 'rgba(37,99,235,0.1)',
                        color: '#60A5FA',
                        border: '1px solid rgba(96,165,250,0.2)',
                      }}
                    >
                      + {t('proposals.create')}
                    </button>
                  </div>

                  {/* Open proposals — shown directly without header */}
                  {openProposals.length > 0 && (
                    <div className="mb-4">
                      <div className="space-y-2">
                        {openProposals.map((p) => (
                          <ProposalCard
                            key={p.id}
                            proposal={p}
                            onVote={handleVote}
                            onConvert={(proposal) => setConvertingProposal(proposal)}
                            onClose={handleCloseProposal}
                            onEdit={handleEditProposal}
                            isVoting={votingProposalId === p.id}
                            isClosing={closingProposalId === p.id}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Closed / Converted proposals — collapsible */}
                  {closedOrConvertedProposals.length > 0 && (
                    <div className="mb-4">
                      <button
                        onClick={() => setShowClosedProposals(!showClosedProposals)}
                        className="flex items-center gap-1.5 text-xs font-bold text-text-dark uppercase tracking-wider mb-2 border-none bg-transparent"
                      >
                        <span
                          className="transition-transform text-[10px]"
                          style={{
                            transform: showClosedProposals ? 'rotate(90deg)' : 'rotate(0deg)',
                          }}
                        >
                          ▶
                        </span>
                        {t('proposals.closed')} ({closedOrConvertedProposals.length})
                      </button>
                      {showClosedProposals && (
                        <div className="space-y-2 opacity-70">
                          {closedOrConvertedProposals.map((p) => (
                            <ProposalCard
                              key={p.id}
                              proposal={p}
                              onVote={handleVote}
                              onConvert={(proposal) => setConvertingProposal(proposal)}
                              onClose={handleCloseProposal}
                              onEdit={handleEditProposal}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </IonContent>

      {/* Edit Event Modal */}
      <EditEventModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingEvent(null);
        }}
        groupId={groupId}
        event={editingEvent}
      />

      {/* Delete confirmation */}
      <IonAlert
        isOpen={!!deletingEvent}
        onDidDismiss={() => setDeletingEvent(null)}
        header={t('plans.deleteEvent')}
        message={t('plans.deleteConfirm')}
        buttons={[
          { text: t('common.cancel'), role: 'cancel' },
          {
            text: t('plans.deleteEvent'),
            role: 'destructive',
            handler: () => {
              if (deletingEvent) {
                setDeletingEventId(deletingEvent.id);
                deleteEvent.mutate(deletingEvent.id, {
                  onSettled: () => setDeletingEventId(null),
                });
              }
            },
          },
        ]}
      />

      {/* Create Proposal Modal */}
      <CreateProposalModal
        isOpen={showCreateProposal}
        onClose={() => setShowCreateProposal(false)}
        groupId={groupId}
      />

      {/* Edit Proposal Modal */}
      <EditProposalModal
        isOpen={showEditProposalModal}
        onClose={() => {
          setShowEditProposalModal(false);
          setEditingProposal(null);
        }}
        groupId={groupId}
        proposal={editingProposal}
      />

      {/* Convert Proposal Modal */}
      <ConvertProposalModal
        isOpen={!!convertingProposal}
        onClose={() => setConvertingProposal(null)}
        groupId={groupId}
        proposal={convertingProposal}
      />

      {/* Cancel confirmation */}
      <IonAlert
        isOpen={!!cancellingEvent}
        onDidDismiss={() => setCancellingEvent(null)}
        header={t('plans.cancelEvent')}
        message={t('plans.cancelConfirm')}
        buttons={[
          { text: t('common.cancel'), role: 'cancel' },
          {
            text: t('plans.cancelEvent'),
            handler: () => {
              if (cancellingEvent) {
                setCancellingEventId(cancellingEvent.id);
                cancelEvent.mutate(cancellingEvent.id, {
                  onSettled: () => setCancellingEventId(null),
                });
              }
            },
          },
        ]}
      />
    </IonPage>
  );
}
