import { useTranslation } from 'react-i18next';
import { getWeekDays, formatDateKey, isSameDay, isToday } from '../lib/date-utils';
import { AvatarStack } from '../ui/AvatarStack';
import { getWeatherIcon } from './WeatherWidget';
import type { Availability } from '../services/availability';
import type { WeatherData } from '../services/weather';
import type { Event } from '../services/events';

interface MemberInfo {
  name: string;
  color: string;
}

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
  secondBestDayKey,
  onMarkAvailability,
  onCreateEvent,
  onViewDetail,
  weatherByDate,
  eventsByDate,
  onEventClick,
}: WeekViewProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'es' ? 'es-ES' : 'en-US';
  const week = getWeekDays(new Date(), weekOffset);

  const monthLabel = week[0].toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric',
  });

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
        const dayAvail = availabilityByDate.get(key) ?? [];
        const myAvail = myAvailabilityByDate.get(key);
        const isSel = isSameDay(selectedDay, day);
        const today = isToday(day);
        const isBest = key === bestDayKey;
        const isSecondBest = key === secondBestDayKey;

        // Build member list with colors
        const availMembers: MemberInfo[] = dayAvail.map((a) => ({
          name: a.user?.name ?? '?',
          color: memberColorMap.get(a.userId) ?? '#60A5FA',
        }));

        // Events for this day
        const dayEvents = eventsByDate?.get(key) ?? [];

        // User's availability label
        let availLabel: string | null = null;
        if (myAvail) {
          if (myAvail.type === 'day') {
            availLabel = t('calendar.allDay');
          } else if (myAvail.type === 'slots' && myAvail.slots) {
            availLabel = myAvail.slots.join(', ');
          } else if (myAvail.type === 'range' && myAvail.startTime && myAvail.endTime) {
            availLabel = `${myAvail.startTime.slice(0, 5)} – ${myAvail.endTime.slice(0, 5)}`;
          }
        }

        return (
          <div
            key={key}
            onClick={() => onSelectDay(isSel ? null : day)}
            className="rounded-card mb-1 cursor-pointer active:scale-[0.98] transition-transform"
            style={{
              padding: '12px 14px',
              border: `1px solid ${isSel ? 'rgba(96,165,250,0.25)' : 'var(--app-border)'}`,
              background: isSel ? 'rgba(37,99,235,0.06)' : 'var(--app-bg-card)',
            }}
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                {/* Day number */}
                <div className="text-center min-w-[36px]">
                  <div className="text-[9px] text-text-dark font-semibold uppercase tracking-wide">
                    {day.toLocaleDateString(locale, { weekday: 'short' })}
                  </div>
                  <div
                    className="text-[19px] font-bold leading-tight"
                    style={{ color: today ? '#60A5FA' : '#CBD5E1' }}
                  >
                    {day.getDate()}
                  </div>
                </div>

                {/* Members info */}
                <div>
                  <div
                    className="flex gap-1 items-center"
                    onClick={(e) => {
                      if (availMembers.length > 0) {
                        e.stopPropagation();
                        onViewDetail(day);
                      }
                    }}
                  >
                    {availMembers.length > 0 && <AvatarStack members={availMembers} size={18} />}
                    <span
                      className="text-[11px] ml-0.5"
                      style={{
                        color: availMembers.length > 0 ? '#64748B' : '#334155',
                      }}
                    >
                      {availMembers.length > 0 ? `${availMembers.length}/${totalMembers}` : '—'}
                    </span>
                    {isBest && (
                      <span
                        className="text-[9px] font-bold tracking-wide px-1.5 py-0.5 rounded-[6px] ml-1"
                        style={{ background: 'rgba(96,165,250,0.12)', color: '#60A5FA' }}
                      >
                        {t('calendar.recommended')}
                      </span>
                    )}
                    {isSecondBest && (
                      <span
                        className="text-[9px] font-bold tracking-wide px-1.5 py-0.5 rounded-[6px] ml-1"
                        style={{ background: 'rgba(148,163,184,0.10)', color: '#94A3B8' }}
                      >
                        {t('calendar.secondRecommended')}
                      </span>
                    )}
                  </div>
                  {availLabel && (
                    <div className="text-[10px] text-primary mt-0.5">
                      {t('calendar.you')}: {availLabel}
                    </div>
                  )}
                  {dayEvents.length > 0 && (
                    <div className="flex flex-col gap-0.5 mt-0.5">
                      {dayEvents.map((ev) => (
                        <button
                          key={ev.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEventClick?.(ev);
                          }}
                          className="flex items-center gap-1 text-[10px] text-left border-none p-0 cursor-pointer bg-transparent"
                          style={{ color: '#F59E0B' }}
                        >
                          <span>📅</span>
                          <span className="truncate max-w-[120px]">{ev.title}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Weather */}
              {(() => {
                const dayWeather = weatherByDate?.get(key);
                if (!dayWeather || dayWeather.length === 0) return null;
                const w = dayWeather[0];
                return (
                  <span className="text-[9px] text-text-muted flex items-center gap-0.5 shrink-0">
                    <span className="text-xs">{getWeatherIcon(w.weatherCode)}</span>
                    {Math.round(w.tempMax)}°
                  </span>
                );
              })()}
            </div>

            {/* Expanded selection */}
            {isSel && (
              <div
                className="mt-2.5 pt-2 flex gap-1.5"
                style={{ borderTop: '1px solid var(--app-border)' }}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkAvailability();
                  }}
                  className="flex-1 py-2 text-xs font-semibold rounded-btn bg-primary-dark text-white border-none"
                >
                  {myAvail ? t('calendar.editAvailability') : t('calendar.markAvailable')}
                </button>
                {availMembers.length >= 2 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCreateEvent(day);
                    }}
                    className="flex-1 py-2 text-xs font-semibold rounded-btn border-none"
                    style={{
                      background: 'var(--app-bg-hover)',
                      color: '#7B8CA8',
                      border: '1px solid var(--app-border-strong)',
                    }}
                  >
                    {t('calendar.createEvent')}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
