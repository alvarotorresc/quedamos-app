import { useState, useMemo } from 'react';
import {
  IonPage,
  IonContent,
  IonHeader,
  IonToolbar,
  IonButtons,
  IonBackButton,
  IonSpinner,
  IonAlert,
  IonActionSheet,
  IonLoading,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useParams, useHistory } from 'react-router-dom';
import { Share } from '@capacitor/share';
import { isShareCancel } from '../lib/share-tarjeta';
import {
  useGroup,
  useGroupInvite,
  useRefreshInvite,
  useLeaveGroup,
  useUpdateMemberRole,
  useKickMember,
  useDeleteGroup,
} from '../hooks/useGroups';
import { useGroupSync } from '../hooks/useGroupSync';
import { useScreenView } from '../hooks/useAnalytics';
import { useAuthStore } from '../stores/auth';
import { useToast } from '../hooks/useToast';
import { runWithErrorToast } from '../lib/mutation-utils';
import { motion } from 'framer-motion';
import { Avatar } from '../ui/Avatar';
import { useGroupWeather } from '../hooks/useWeather';
import { useAnalytics } from '../hooks/useAnalytics';
import { useGroupCities, useAddCity, useRemoveCity } from '../hooks/useGroupCities';
import { useCitySearch } from '../hooks/useCitySearch';
import type { GeocodingResult } from '../services/weather';
import { getMemberColorByUserId } from '../lib/constants';
import { buildMemberColorMap } from '../lib/member-colors';
import { GroupRing } from '../components/GroupRing';
import {
  HiOutlineArrowPath,
  HiOutlineCalendar,
  HiOutlineQuestionMarkCircle,
  HiOutlineShare,
  HiOutlineDocumentDuplicate,
  HiOutlineSun,
  HiOutlineUsers,
  HiOutlineUser,
  HiOutlineEllipsisHorizontal,
} from 'react-icons/hi2';
import { Tile } from '../ui/Tile';
import { Aro, type AroMember } from '../ui/Aro';
import { useEvents } from '../hooks/useEvents';
import { usePolls } from '../hooks/usePolls';
import { apiDateToKey, formatDateKey, capitalizeFirst } from '../lib/date-utils';
import { SLOT_KEYS } from '../lib/availability-label';
import { getWeatherIcon } from '../components/WeatherWidget';

const COLOR_NAME_KEY: Record<string, string> = {
  '#60A5FA': 'colors.blue',
  '#F59E0B': 'colors.orange',
  '#F472B6': 'colors.pink',
  '#34D399': 'colors.green',
  '#A78BFA': 'colors.purple',
  '#FB7185': 'colors.red',
};

function formatCode(code: string): string {
  return code.slice(0, 4) + '-' + code.slice(4);
}

export default function GroupDetailPage() {
  useScreenView('GroupDetail');
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const history = useHistory();
  const currentUserId = useAuthStore((s) => s.user?.id);

  const { data: group, isLoading } = useGroup(id);
  useGroupSync(id);
  const { data: invite } = useGroupInvite(id);
  const refreshInvite = useRefreshInvite();
  const leaveGroup = useLeaveGroup();
  const updateRole = useUpdateMemberRole(id);
  const kickMember = useKickMember(id);
  const deleteGroup = useDeleteGroup();

  const { track } = useAnalytics();
  const { showError } = useToast();
  const [copied, setCopied] = useState(false);
  const [showLeaveAlert, setShowLeaveAlert] = useState(false);
  const [showRegenerateAlert, setShowRegenerateAlert] = useState(false);
  const [regeneratedFeedback, setRegeneratedFeedback] = useState(false);
  const [actionMember, setActionMember] = useState<{
    userId: string;
    name: string;
    role: string;
  } | null>(null);
  const [showDeleteGroupAlert, setShowDeleteGroupAlert] = useState(false);
  const [showKickAlert, setShowKickAlert] = useState(false);

  // Weather & Cities
  const { data: cities } = useGroupCities(id);
  const { data: weather } = useGroupWeather(id);
  const addCity = useAddCity(id);
  const removeCity = useRemoveCity(id);
  const [citySearch, setCitySearch] = useState('');
  const cityResults = useCitySearch(citySearch);
  const [showCitySearch, setShowCitySearch] = useState(false);

  // Member color map (userId -> color), by join order within the group
  const colorMap = useMemo(() => buildMemberColorMap(group?.members ?? []), [group?.members]);

  const { i18n } = useTranslation();
  const locale = i18n.language === 'es' ? 'es-ES' : 'en-US';
  const { data: events } = useEvents(id);
  const { data: polls } = usePolls(id);
  const today = formatDateKey(new Date());

  const nextEvent = useMemo(() => {
    const upcoming = (events ?? []).filter(
      (ev) => ev.status !== 'cancelled' && apiDateToKey(ev.date) >= today,
    );
    upcoming.sort((a, b) => apiDateToKey(a.date).localeCompare(apiDateToKey(b.date)));
    return upcoming[0] ?? null;
  }, [events, today]);

  const openPoll = useMemo(() => {
    const open = (polls ?? []).filter((p) => p.status === 'open' && apiDateToKey(p.date) >= today);
    open.sort((a, b) => apiDateToKey(a.date).localeCompare(apiDateToKey(b.date)));
    return open[0] ?? null;
  }, [polls, today]);

  const myColor = currentUserId ? colorMap.get(currentUserId) : undefined;

  const handleCopy = async () => {
    if (!invite?.inviteCode) return;
    try {
      await navigator.clipboard.writeText(invite.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showError('errors.copyFailed');
    }
  };

  const handleShare = async () => {
    if (!invite?.inviteUrl || !group) return;
    try {
      await Share.share({
        title: group.name,
        text: t('group.shareMessage'),
        url: invite.inviteUrl,
        dialogTitle: t('group.shareMessage'),
      });
      track('share_group');
    } catch (error) {
      // Dismissing the sheet is a decision, not a failure: fall through to nothing.
      if (isShareCancel(error)) return;
      // Capacitor Share failed — try Web Share API
      if (navigator.share) {
        try {
          await navigator.share({
            title: group.name,
            text: t('group.shareMessage'),
            url: invite.inviteUrl,
          });
          track('share_group');
          return;
        } catch (webError) {
          // Same here: a cancelled web share must not end up copying the code
          // (and possibly raising errors.copyFailed) behind the user's back.
          if (isShareCancel(webError)) return;
        }
      }
      // Final fallback: copy to clipboard
      handleCopy();
    }
  };

  const handleAddCity = async (result: GeocodingResult) => {
    await runWithErrorToast(
      () =>
        addCity.mutateAsync({
          name: result.name,
          lat: result.latitude,
          lon: result.longitude,
        }),
      showError,
      {
        onSuccess: () => {
          setCitySearch('');
          setShowCitySearch(false);
        },
        errorKey: 'errors.addCityFailed',
      },
    );
  };

  const handleRemoveCity = async (cityId: string) => {
    await runWithErrorToast(() => removeCity.mutateAsync(cityId), showError, {
      errorKey: 'errors.removeCityFailed',
    });
  };

  const handleRegenerate = async () => {
    await runWithErrorToast(() => refreshInvite.mutateAsync(id), showError, {
      onSuccess: () => {
        setRegeneratedFeedback(true);
        setTimeout(() => setRegeneratedFeedback(false), 2000);
      },
      errorKey: 'errors.regenerateCodeFailed',
    });
  };

  const handleLeave = async () => {
    await runWithErrorToast(() => leaveGroup.mutateAsync(id), showError, {
      onSuccess: () => history.replace('/tabs/group'),
      errorKey: 'errors.leaveGroupFailed',
    });
  };

  const handleUpdateRole = async (userId: string, role: 'admin' | 'member') => {
    await runWithErrorToast(() => updateRole.mutateAsync({ userId, role }), showError, {
      errorKey: 'errors.updateRoleFailed',
    });
  };

  const handleKick = async (userId: string) => {
    await runWithErrorToast(() => kickMember.mutateAsync(userId), showError, {
      errorKey: 'errors.kickMemberFailed',
    });
  };

  const getActionButtons = () => {
    if (!actionMember) return [];
    const buttons: Array<{ text: string; role?: string; handler?: () => void }> = [];

    if (actionMember.role === 'member') {
      buttons.push({
        text: t('group.promoteAdmin'),
        handler: () => handleUpdateRole(actionMember.userId, 'admin'),
      });
      buttons.push({
        text: t('group.kickMember'),
        role: 'destructive',
        handler: () => setShowKickAlert(true),
      });
    } else if (actionMember.role === 'admin') {
      buttons.push({
        text: t('group.demoteAdmin'),
        handler: () => handleUpdateRole(actionMember.userId, 'member'),
      });
    }

    buttons.push({ text: t('group.cancel'), role: 'cancel' });
    return buttons;
  };

  const handleDeleteGroup = async () => {
    await runWithErrorToast(() => deleteGroup.mutateAsync(id), showError, {
      onSuccess: () => history.replace('/tabs/group'),
      errorKey: 'errors.deleteGroupFailed',
    });
  };

  if (isLoading) {
    return (
      <IonPage>
        <IonContent>
          <div className="flex items-center justify-center h-full">
            <IonSpinner name="crescent" className="text-primary w-8 h-8" />
          </div>
        </IonContent>
      </IonPage>
    );
  }

  const isAdmin =
    group?.members.some((m) => m.userId === currentUserId && m.role === 'admin') ?? false;

  if (!group) return null;

  const dayOf = (dateStr: string) => new Date(apiDateToKey(dateStr) + 'T00:00:00');
  const weekdayShort = (d: Date) =>
    d.toLocaleDateString(locale, { weekday: 'short' }).replace('.', '').toUpperCase();
  const memberRing = (onIds: Set<string>): AroMember[] =>
    [...colorMap.entries()].map(([userId, color]) => ({
      color,
      state: onIds.has(userId) ? 'on' : 'off',
    }));
  const cityEditorOpen = showCitySearch;
  const sinceMonth = group.createdAt
    ? new Date(group.createdAt).toLocaleDateString(locale, { month: 'long' })
    : '';
  const answered = new Set(openPoll?.responses.map((r) => r.userId) ?? []);
  const missing = openPoll
    ? group.members.filter((m) => !answered.has(m.userId)).map((m) => m.user.name)
    : [];
  const pollLabel = openPoll
    ? `${capitalizeFirst(dayOf(openPoll.date).toLocaleDateString(locale, { weekday: 'long' }))}${
        openPoll.slot && SLOT_KEYS[openPoll.slot] ? ` ${t(SLOT_KEYS[openPoll.slot]).toLowerCase()}` : ''
      }`
    : '';
  const firstWeather = weather && weather.length > 0 ? weather[0] : null;
  const iconButtonClass =
    'p-2 -m-1 rounded-lg border-none bg-transparent active:bg-bg-hover transition-colors';

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar className="py-2">
          <IonButtons slot="start">
            <IonBackButton defaultHref="/tabs/group" text="" />
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <div className="max-w-md mx-auto px-4 pb-6">
          {/* Identidad: el aro de la cuadrilla */}
          <div className="flex flex-col items-center text-center pt-1 pb-5">
            <GroupRing members={group.members} emoji={group.emoji} />
            <h1 className="text-[22px] font-extrabold tracking-tight text-text leading-tight mt-3.5">
              {group.name}
            </h1>
            {myColor && COLOR_NAME_KEY[myColor] && (
              <p className="text-xs text-text-muted mt-0.5">
                {t('group.heroSubtitle', { color: t(COLOR_NAME_KEY[myColor]) })}
              </p>
            )}
            <p
              className="font-mono text-[10px] tracking-[0.12em] uppercase mt-2"
              style={{ color: myColor ?? 'var(--app-text-muted)' }}
            >
              {sinceMonth && t('group.since', { month: sinceMonth })}
              {sinceMonth && invite && ' · '}
              {invite && t('group.code', { code: formatCode(invite.inviteCode) })}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {/* Próxima quedada */}
            <Tile
              label={t('group.tiles.nextEvent')}
              icon={<HiOutlineCalendar className="w-4 h-4" />}
              span={2}
              onClick={() =>
                history.push(nextEvent ? `/tabs/plans?eventId=${nextEvent.id}` : '/tabs/calendar')
              }
            >
              {nextEvent ? (
                <div className="flex items-center gap-3">
                  <div className="flex items-baseline gap-1 w-[54px] shrink-0">
                    <span className="text-[34px] font-extrabold leading-none text-text">
                      {dayOf(nextEvent.date).getDate()}
                    </span>
                    <span className="font-mono text-[9px] tracking-[0.12em] text-text-muted">
                      {weekdayShort(dayOf(nextEvent.date))}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-bold text-text truncate">{nextEvent.title}</p>
                    <p className="font-mono text-[11px] text-text-muted mt-0.5 truncate">
                      {[nextEvent.time?.slice(0, 5), nextEvent.location].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <Aro
                    members={memberRing(
                      new Set(
                        nextEvent.attendees
                          .filter((a) => a.status === 'confirmed')
                          .map((a) => a.userId),
                      ),
                    )}
                    size={40}
                  />
                </div>
              ) : (
                <p className="text-sm text-text-muted">{t('group.tiles.nextEventEmpty')}</p>
              )}
            </Tile>

            {/* En el aire */}
            <Tile
              label={t('group.tiles.openQuestion')}
              icon={<HiOutlineQuestionMarkCircle className="w-4 h-4" />}
              onClick={openPoll ? () => history.push('/tabs/calendar') : undefined}
            >
              {openPoll ? (
                <div className="flex items-center gap-2.5">
                  <Aro members={memberRing(answered)} size={40} />
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-text truncate">{pollLabel}</p>
                    <p className="text-[11px] text-text-muted truncate">
                      {missing.length > 0
                        ? t('group.tiles.missing', { names: missing.join(', '), count: missing.length })
                        : t('group.tiles.everyoneAnswered')}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-[13px] text-text-muted">{t('group.tiles.noQuestion')}</p>
              )}
            </Tile>

            {/* Invitar */}
            <Tile label={t('group.tiles.invite')} icon={<HiOutlineShare className="w-4 h-4" />}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[15px] font-bold tracking-[0.08em] text-text whitespace-nowrap">
                  {invite ? formatCode(invite.inviteCode) : '····-····'}
                </span>
                <span className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className={iconButtonClass}
                    aria-label={copied ? t('group.codeCopied') : t('group.copyCode')}
                    title={copied ? t('group.codeCopied') : t('group.copyCode')}
                  >
                    <HiOutlineDocumentDuplicate
                      className={`w-4 h-4 ${copied ? 'text-success' : 'text-text-dark'}`}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={handleShare}
                    className={iconButtonClass}
                    aria-label={t('group.share')}
                    title={t('group.share')}
                  >
                    <HiOutlineShare className="w-4 h-4 text-text-dark" />
                  </button>
                </span>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setShowRegenerateAlert(true)}
                  disabled={refreshInvite.isPending}
                  className="inline-flex items-center gap-1 self-start text-[11px] text-text-muted bg-transparent border-none p-0"
                >
                  <HiOutlineArrowPath className="w-3 h-3" />
                  {regeneratedFeedback
                    ? t('group.codeRegenerated')
                    : refreshInvite.isPending
                      ? t('group.regenerating')
                      : t('group.regenerateCode')}
                </button>
              )}
            </Tile>

            {/* El tiempo */}
            <Tile
              label={t('group.tiles.weather')}
              icon={<HiOutlineSun className="w-4 h-4" />}
              onClick={isAdmin ? () => setShowCitySearch((v) => !v) : undefined}
            >
              {firstWeather ? (
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-text truncate">{firstWeather.city}</p>
                    <p className="text-[11px] text-text-muted">
                      {Math.round(firstWeather.tempMax)}° / {Math.round(firstWeather.tempMin)}°
                    </p>
                  </div>
                  <span className="text-[22px] leading-none" aria-hidden="true">
                    {getWeatherIcon(firstWeather.weatherCode)}
                  </span>
                </div>
              ) : (
                <p className="text-[13px] text-text-muted">
                  {isAdmin ? `+ ${t('weather.addCity')}` : t('group.tiles.noCity')}
                </p>
              )}
            </Tile>

            {/* Grupo */}
            <Tile label={t('group.tiles.group')} icon={<HiOutlineUsers className="w-4 h-4" />}>
              <div className="flex flex-col gap-1 text-[13px]">
                <div className="flex justify-between gap-2">
                  <span className="text-text">{t('group.tiles.name')}</span>
                  <span className="text-text-muted truncate">
                    {group.name} {group.emoji}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-text">{t('group.tiles.cities')}</span>
                  <span className="text-text-muted">{cities?.length ?? 0}</span>
                </div>
              </div>
            </Tile>

            {/* Miembros */}
            <Tile
              label={`${t('group.tiles.members')} · ${group.members.length}`}
              icon={<HiOutlineUser className="w-4 h-4" />}
              span={2}
            >
              <div className="flex flex-col">
                {group.members.map((member, i) => (
                  <motion.div
                    key={member.userId}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.3 }}
                    className={`flex items-center gap-2.5 py-2 ${
                      i < group.members.length - 1 ? 'border-b border-subtle' : ''
                    }`}
                  >
                    <Avatar
                      name={member.user.name}
                      color={colorMap.get(member.userId) ?? getMemberColorByUserId(member.userId)}
                      size={28}
                    />
                    <span className="flex-1 min-w-0 text-[13px] text-text truncate">
                      {member.user.name}
                    </span>
                    {member.userId === group.createdById && (
                      <span className="font-mono text-[9px] tracking-[0.06em] uppercase text-text-muted border border-strong rounded-pill px-2 py-px">
                        {t('group.creator')}
                      </span>
                    )}
                    {member.role === 'admin' && member.userId !== group.createdById && (
                      <span className="font-mono text-[9px] tracking-[0.06em] uppercase text-text-muted border border-strong rounded-pill px-2 py-px">
                        {t('group.admin')}
                      </span>
                    )}
                    {member.userId === currentUserId && (
                      <span
                        className="font-mono text-[9px] tracking-[0.06em] uppercase"
                        style={{ color: myColor ?? 'var(--app-text-muted)' }}
                      >
                        {t('group.memberYou')}
                      </span>
                    )}
                    {isAdmin &&
                      member.userId !== currentUserId &&
                      member.userId !== group.createdById && (
                        <button
                          type="button"
                          onClick={() =>
                            setActionMember({
                              userId: member.userId,
                              name: member.user.name,
                              role: member.role,
                            })
                          }
                          className={iconButtonClass}
                          aria-label={member.user.name}
                        >
                          <HiOutlineEllipsisHorizontal className="w-4 h-4 text-text-dark" />
                        </button>
                      )}
                  </motion.div>
                ))}
              </div>
            </Tile>
          </div>

          {/* Editor de ciudades (admin), desplegado desde la ficha del tiempo */}
          {isAdmin && cityEditorOpen && (
            <div className="mt-3 bg-bg-light border border-subtle rounded-lg p-3.5">
              <input
                type="text"
                value={citySearch}
                onChange={(e) => setCitySearch(e.target.value)}
                placeholder={t('weather.searchCity')}
                className="w-full rounded-[10px] px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-dark mb-2 bg-bg-hover border border-strong"
              />
              {cityResults.length > 0 && (
                <div className="rounded-[10px] overflow-hidden bg-bg-card border border-subtle mb-2">
                  {cityResults.map((r, i) => (
                    <button
                      key={`${r.name}-${r.latitude}-${i}`}
                      onClick={() => handleAddCity(r)}
                      className={`w-full text-left px-3 py-2 text-sm text-text border-none bg-transparent hover:bg-bg-hover ${
                        i < cityResults.length - 1 ? 'border-b border-subtle' : ''
                      }`}
                    >
                      {r.name}
                      {r.admin1 ? `, ${r.admin1}` : ''} — {r.country}
                    </button>
                  ))}
                </div>
              )}
              {cities && cities.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {cities.map((city) => (
                    <span
                      key={city.id}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] text-text-muted bg-bg-card border border-subtle"
                    >
                      📍 {city.name}
                      <button
                        onClick={() => handleRemoveCity(city.id)}
                        className="text-text-dark hover:text-danger ml-0.5 border-none bg-transparent text-[10px]"
                        aria-label={`${t('group.cancel')} ${city.name}`}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Salir / eliminar */}
          <div className="flex flex-col items-center gap-1 mt-5">
            <button
              type="button"
              onClick={() => setShowLeaveAlert(true)}
              disabled={leaveGroup.isPending}
              className="py-3 px-4 text-[13px] font-bold text-danger bg-transparent border-none"
            >
              {leaveGroup.isPending ? t('group.leaving') : t('group.leaveGroup')}
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setShowDeleteGroupAlert(true)}
                className="py-2 px-4 text-[11px] text-text-dark bg-transparent border-none"
              >
                {t('group.deleteGroup')}
              </button>
            )}
          </div>

          {/* Alerts */}
          <IonAlert
            isOpen={showLeaveAlert}
            onDidDismiss={() => setShowLeaveAlert(false)}
            header={t('group.leaveTitle')}
            message={t('group.leaveMessage')}
            buttons={[
              { text: t('group.cancel'), role: 'cancel' },
              { text: t('group.leaveGroup'), role: 'destructive', handler: handleLeave },
            ]}
          />
          <IonAlert
            isOpen={showRegenerateAlert}
            onDidDismiss={() => setShowRegenerateAlert(false)}
            header={t('group.regenerateTitle')}
            message={t('group.regenerateMessage')}
            buttons={[
              { text: t('group.cancel'), role: 'cancel' },
              { text: t('group.regenerateCode'), handler: handleRegenerate },
            ]}
          />
          <IonActionSheet
            isOpen={actionMember !== null && !showKickAlert}
            onDidDismiss={() => {
              if (!showKickAlert) setActionMember(null);
            }}
            header={actionMember?.name}
            buttons={getActionButtons()}
          />
          <IonAlert
            isOpen={showDeleteGroupAlert}
            onDidDismiss={() => setShowDeleteGroupAlert(false)}
            header={t('group.deleteConfirm')}
            message={t('group.deleteMessage')}
            buttons={[
              { text: t('group.cancel'), role: 'cancel' },
              { text: t('group.deleteGroup'), role: 'destructive', handler: handleDeleteGroup },
            ]}
          />
          <IonAlert
            isOpen={showKickAlert}
            onDidDismiss={() => {
              setShowKickAlert(false);
              setActionMember(null);
            }}
            header={t('group.kickConfirm', { name: actionMember?.name })}
            message={t('group.kickMessage')}
            buttons={[
              { text: t('group.cancel'), role: 'cancel' },
              {
                text: t('group.kickMember'),
                role: 'destructive',
                handler: () => {
                  if (actionMember) handleKick(actionMember.userId);
                },
              },
            ]}
          />
          <IonLoading isOpen={kickMember.isPending} message={t('group.kickMember')} />
        </div>
      </IonContent>
    </IonPage>
  );
}
