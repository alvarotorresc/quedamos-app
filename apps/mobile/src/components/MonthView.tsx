import { useTranslation } from 'react-i18next';
import { getMonthCells, formatDateKey, isSameDay, isToday } from '../lib/date-utils';
import { AvatarStack } from '../ui/AvatarStack';
import { getWeatherIcon } from './WeatherWidget';
import type { Availability } from '../services/availability';
import type { WeatherData } from '../services/weather';
import type { Event } from '../services/events';

interface MemberInfo {
  name: string;
  color: string;
}

interface MonthViewProps {
  monthOffset: number;
  onMonthChange: (offset: number) => void;
  selectedDay: Date | null;
  onSelectDay: (day: Date | null) => void;
  availabilityByDate: Map<string, Availability[]>;
  myAvailabilityByDate: Map<string, Availability>;
  memberColorMap: Map<string, string>;
  totalMembers: number;
  onMarkAvailability: () => void;
  onCreateEvent: (day: Date) => void;
  onViewDetail: (day: Date) => void;
  weatherByDate?: Map<string, WeatherData[]>;
  eventsByDate?: Map<string, Event[]>;
  onEventClick?: (event: Event) => void;
}

export function MonthView({
  monthOffset,
  onMonthChange,
  selectedDay,
  onSelectDay,
  availabilityByDate,
  myAvailabilityByDate,
  memberColorMap,
  totalMembers,
  onMarkAvailability,
  onCreateEvent,
  onViewDetail,
  weatherByDate,
  eventsByDate,
  onEventClick,
}: MonthViewProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'es' ? 'es-ES' : 'en-US';
  const { cells, month } = getMonthCells(new Date(), monthOffset);

  const weekdays = t('calendar.weekdays', { returnObjects: true }) as string[];

  const monthLabel = month.toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric',
  });

  // Selected day details
  const selKey = selectedDay ? formatDateKey(selectedDay) : null;
  const selAvail = selKey ? (availabilityByDate.get(selKey) ?? []) : [];
  const selEvents = selKey ? (eventsByDate?.get(selKey) ?? []) : [];
  const selMembers: MemberInfo[] = selAvail.map((a) => ({
    name: a.user?.name ?? '?',
    color: memberColorMap.get(a.userId) ?? '#60A5FA',
  }));
  const selMyAvail = selKey ? myAvailabilityByDate.get(selKey) : undefined;

  return (
    <div>
      {/* Navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => onMonthChange(monthOffset - 1)}
          className="text-text-dark text-lg px-3 py-1 bg-transparent border-none"
        >
          ‹
        </button>
        <span className="text-text-dark text-sm font-semibold capitalize">{monthLabel}</span>
        <button
          onClick={() => onMonthChange(monthOffset + 1)}
          className="text-text-dark text-lg px-3 py-1 bg-transparent border-none"
        >
          ›
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {weekdays.map((d, i) => (
          <div key={i} className="text-center text-[11px] text-text-dark font-semibold py-1.5">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`} />;

          const key = formatDateKey(day);
          const dayAvail = availabilityByDate.get(key) ?? [];
          const ratio = totalMembers > 0 ? dayAvail.length / totalMembers : 0;
          const today = isToday(day);
          const isSel = isSameDay(day, selectedDay);

          // Members with colors for dots
          const dayEvents = eventsByDate?.get(key) ?? [];

          const dotMembers = dayAvail.slice(0, 4).map((a) => ({
            userId: a.userId,
            color: memberColorMap.get(a.userId) ?? '#60A5FA',
          }));

          return (
            <div
              key={key}
              onClick={() => onSelectDay(isSel ? null : day)}
              className="text-center py-2.5 px-1 rounded-[10px] cursor-pointer aspect-square flex flex-col items-center justify-center"
              style={{
                background: isSel
                  ? 'rgba(37,99,235,0.18)'
                  : ratio > 0.5
                    ? `rgba(96,165,250,${ratio * 0.12})`
                    : 'transparent',
                border: today ? '1px solid rgba(96,165,250,0.3)' : '1px solid transparent',
              }}
            >
              <div
                className="text-sm"
                style={{
                  fontWeight: today ? 700 : 400,
                  color: isSel || today ? '#60A5FA' : '#94A3B8',
                }}
              >
                {day.getDate()}
              </div>
              {(() => {
                const dayWeather = weatherByDate?.get(key);
                if (!dayWeather || dayWeather.length === 0) return null;
                return (
                  <div className="text-[8px] leading-none mt-0.5">
                    {getWeatherIcon(dayWeather[0].weatherCode)}
                  </div>
                );
              })()}
              <div className="flex justify-center gap-[2px] mt-1">
                {dayEvents.length > 0 && (
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#F59E0B' }} />
                )}
                {dotMembers.map((m) => (
                  <div
                    key={m.userId}
                    className="w-1 h-1 rounded-full"
                    style={{ background: m.color }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected day detail panel */}
      {selectedDay && (
        <div
          className="rounded-card mt-3"
          style={{
            background: 'var(--app-bg-card)',
            border: '1px solid var(--app-border)',
            padding: '12px 14px',
          }}
        >
          <div className="text-[13px] font-semibold text-text mb-1 capitalize">
            {selectedDay.toLocaleDateString(locale, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </div>

          {selMembers.length > 0 ? (
            <div
              onClick={() => selectedDay && onViewDetail(selectedDay)}
              className="cursor-pointer"
            >
              <AvatarStack members={selMembers} />
              <div className="text-[10px] text-text-dark mt-1">
                {selMembers.map((m) => m.name).join(', ')}
              </div>
            </div>
          ) : (
            <div className="text-[11px] text-text-dark">{t('calendar.noAvailability')}</div>
          )}

          {selEvents.length > 0 && (
            <div className="mt-2 space-y-1">
              {selEvents.map((ev) => (
                <button
                  key={ev.id}
                  onClick={() => onEventClick?.(ev)}
                  className="flex items-center gap-1.5 w-full text-left text-[11px] border-none bg-transparent p-0 cursor-pointer"
                  style={{ color: '#F59E0B' }}
                >
                  <span>📅</span>
                  <span className="truncate text-text">{ev.title}</span>
                  {ev.time && (
                    <span className="text-text-dark shrink-0">{ev.time.slice(0, 5)}</span>
                  )}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-1.5 mt-2">
            <button
              onClick={onMarkAvailability}
              className="flex-1 py-[7px] text-xs font-semibold rounded-btn bg-primary-dark text-white border-none"
            >
              {selMyAvail ? t('calendar.editAvailability') : t('calendar.available')}
            </button>
            {selMembers.length >= 2 && selectedDay && (
              <button
                onClick={() => onCreateEvent(selectedDay)}
                className="flex-1 py-[7px] text-xs font-semibold rounded-btn border-none"
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
        </div>
      )}
    </div>
  );
}
