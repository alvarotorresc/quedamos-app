import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getWeekDays, formatDateKey, isSameDay } from '../lib/date-utils';
import { availabilityLabel } from '../lib/availability-label';
import { Aro, type AroMember } from '../ui/Aro';
import { Button } from '../ui/Button';
import { useGroupInvite } from '../hooks/useGroups';
import { useToast } from '../hooks/useToast';
import { useAnalytics } from '../hooks/useAnalytics';
import { useThemeStore } from '../stores/theme';
import { runWithErrorToast } from '../lib/mutation-utils';
import { renderTarjetaCerrada } from '../lib/tarjeta';
import { shareTarjeta } from '../lib/share-tarjeta';
import type { Availability } from '../services/availability';
import type { WeatherData } from '../services/weather';
import type { Event } from '../services/events';

interface WeekViewProps {
  weekOffset: number;
  onWeekChange: (offset: number) => void;
  selectedDay: Date | null;
  onSelectDay: (day: Date | null) => void;
  availabilityByDate: Map<string, Availability[]>;
  myAvailabilityByDate: Map<string, Availability>;
  memberColorMap: Map<string, string>;
  totalMembers: number;
  bestDayKey?: string | null;
  secondBestDayKey?: string | null;
  onMarkAvailability: () => void;
  onCreateEvent: (day: Date) => void;
  onViewDetail: (day: Date) => void;
  weatherByDate?: Map<string, WeatherData[]>;
  eventsByDate?: Map<string, Event[]>;
  onEventClick?: (event: Event) => void;
  onAskGroup?: (day: Date) => void;
  /** Group id — used to fetch the invite link the shared aro card includes. */
  groupId: string;
}

export function WeekView({
  weekOffset,
  onWeekChange,
  selectedDay,
  onSelectDay,
  availabilityByDate,
  myAvailabilityByDate,
  memberColorMap,
  totalMembers,
  bestDayKey,
  onMarkAvailability,
  onCreateEvent,
  weatherByDate,
  eventsByDate,
  onEventClick,
  onAskGroup,
  groupId,
}: WeekViewProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'es' ? 'es-ES' : 'en-US';
  const week = getWeekDays(new Date(), weekOffset);
  const todayKey = formatDateKey(new Date());
  const { data: invite } = useGroupInvite(groupId);
  const darkMode = useThemeStore((s) => s.darkMode);
  const { showError, showInfo } = useToast();
  const { track } = useAnalytics();
  const [sharing, setSharing] = useState(false);

  const monthLabel = week[0].toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric',
  });

  const handleShareBestDay = async (day: Date) => {
    if (sharing) return;
    if (!invite?.inviteUrl) return;
    const weekdayLabel = day.toLocaleDateString(locale, { weekday: 'long' });
    const dayNumber = String(day.getDate());
    const theme: 'dia' | 'noche' = darkMode ? 'noche' : 'dia';

    setSharing(true);
    try {
      await runWithErrorToast(
        async () => {
          const blob = await renderTarjetaCerrada({
            weekdayLabel,
            dayNumber,
            titulo: t('share.cardCerrada'),
            subtitulo: t('calendar.allCan', { count: totalMembers }),
            memberColors: [...memberColorMap.values()],
            theme,
            marca: t('landing.brand'),
            pie: invite.inviteUrl.replace(/^https?:\/\//, ''),
          });
          const texto = t('share.tarjetaCerrada', {
            fecha: `${weekdayLabel} ${dayNumber}`,
          });
          const { shared } = await shareTarjeta({
            blob,
            texto,
            inviteUrl: invite.inviteUrl,
            filename: 'quedamos-tarjeta.png',
            showInfo,
          });
          if (shared) {
            track('share_tarjeta', { momento: 'cerrada' });
          }
        },
        showError,
        { errorKey: 'errors.shareTarjetaFailed' },
      );
    } finally {
      setSharing(false);
    }
  };

  return (
    <div>
      {/* Navigation */}
      <div className="flex items-center justify-between mb-1.5">
        <button
          onClick={() => onWeekChange(weekOffset - 1)}
          className="text-text-dark text-base px-2 py-1 bg-transparent border-none"
        >
          ‹
        </button>
        <span className="text-text-dark text-xs font-semibold capitalize">{monthLabel}</span>
        <button
          onClick={() => onWeekChange(weekOffset + 1)}
          className="text-text-dark text-base px-2 py-1 bg-transparent border-none"
        >
          ›
        </button>
      </div>

      {/* Days */}
      {week.map((day) => {
        const key = formatDateKey(day);
        const isPast = key < todayKey;
        const dayAvail = availabilityByDate.get(key) ?? [];
        const myAvail = myAvailabilityByDate.get(key);
        const isSel = isSameDay(selectedDay, day);
        const availCount = dayAvail.length;
        const dayWeather = weatherByDate?.get(key) ?? [];
        const dayEvents = eventsByDate?.get(key) ?? [];

        const availUserIds = new Set(dayAvail.map((a) => a.userId));
        const aroMembers: AroMember[] = [...memberColorMap.entries()].map(([userId, color]) => ({
          color,
          state: availUserIds.has(userId) ? 'on' : 'off',
        }));

        const countLabel =
          availCount === 0
            ? '—'
            : availCount === totalMembers
              ? t('calendar.allCan', { count: totalMembers })
              : availCount === 1
                ? t('calendar.canCountOne')
                : t('calendar.canCount', { count: availCount });

        if (key === bestDayKey && availCount === totalMembers && dayEvents.length === 0) {
          return (
            <div
              key={key}
              data-testid="best-day-panel"
              className="bg-primary-solid rounded-[20px] p-4 my-2 flex flex-col gap-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex items-baseline gap-1.5 w-[54px]">
                  <span className="text-[40px] font-extrabold leading-none text-on-primary">
                    {day.getDate()}
                  </span>
                  <span className="font-mono text-[9px] tracking-[0.12em] text-muted-panel uppercase">
                    {day.toLocaleDateString(locale, { weekday: 'short' }).replace('.', '')}
                  </span>
                </div>
                <Aro members={aroMembers} size={46} />
                <div className="flex-1">
                  <p className="text-[16px] font-bold text-on-primary leading-tight">
                    {t('calendar.bestDayQuestion', {
                      weekday: day.toLocaleDateString(locale, { weekday: 'long' }),
                    })}
                  </p>
                  <p className="text-xs text-muted-panel">
                    {t('calendar.allCan', { count: totalMembers })}
                    {dayWeather[0] ? ` · ${Math.round(dayWeather[0].tempMax)}°` : ''}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreateEvent(day);
                  }}
                  className="flex-1 bg-bg text-text rounded-pill py-3 text-sm font-bold"
                >
                  {t('calendar.letsMeet')}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectDay(day);
                    onMarkAvailability();
                  }}
                  className="flex-1 border border-strong text-on-primary rounded-pill py-3 text-sm font-semibold"
                >
                  {t('calendar.editAvailability')}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleShareBestDay(day);
                  }}
                  disabled={sharing}
                  className="border border-strong text-on-primary rounded-pill py-3 px-4 text-sm font-semibold disabled:opacity-40 disabled:pointer-events-none"
                >
                  {t('group.share')}
                </button>
              </div>
            </div>
          );
        }

        return (
          <Fragment key={key}>
            <div
              data-testid="day-row"
              onClick={() => onSelectDay(isSel ? null : day)}
              className="flex items-center gap-3 py-2 border-t border-subtle cursor-pointer"
            >
              <div className="flex items-baseline gap-1.5 w-[58px]">
                <span
                  className={`text-[26px] font-extrabold leading-none ${availCount === 0 ? 'text-text-muted' : 'text-text'}`}
                >
                  {day.getDate()}
                </span>
                <span className="font-mono text-[9px] tracking-[0.12em] text-text-muted uppercase">
                  {day.toLocaleDateString(locale, { weekday: 'short' }).replace('.', '')}
                </span>
              </div>
              <Aro members={aroMembers} size={36} />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-text">{countLabel}</p>
                {myAvail ? (
                  <p className="text-[11px] text-text-muted truncate">
                    {t('calendar.you')}: {availabilityLabel(myAvail, t)}
                  </p>
                ) : (
                  <p className="text-[11px] text-text-dark">{t('calendar.you')}: —</p>
                )}
                {dayEvents.map((ev) => (
                  <button
                    key={ev.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick?.(ev);
                    }}
                    className="font-mono text-[10px] text-text-muted uppercase truncate block"
                  >
                    {ev.title} · {ev.time?.slice(0, 5) ?? ''}
                  </button>
                ))}
              </div>
              {dayWeather[0] && (
                <span className="font-mono text-[11px] text-text-muted">
                  {Math.round(dayWeather[0].tempMax)}°
                </span>
              )}
            </div>
            {isSel && (
              <div className="flex gap-1.5 pb-2 -mt-0.5">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkAvailability();
                  }}
                  className="flex-1"
                >
                  {myAvail ? t('calendar.editAvailability') : t('calendar.markAvailable')}
                </Button>
                {onAskGroup && !isPast && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAskGroup(day);
                    }}
                  >
                    {t('calendar.ask')}
                  </Button>
                )}
                {availCount >= 2 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCreateEvent(day);
                    }}
                    className="flex-1"
                  >
                    {t('calendar.createEvent')}
                  </Button>
                )}
              </div>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
