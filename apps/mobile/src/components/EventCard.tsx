import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { AvatarStack } from '../ui/AvatarStack';
import { Button } from '../ui/Button';
import { HiOutlineMapPin, HiOutlineClock, HiOutlinePencil } from 'react-icons/hi2';
import { useRespondEvent } from '../hooks/useEvents';
import { useAuthStore } from '../stores/auth';
import { apiDateToKey, formatDateKey } from '../lib/date-utils';
import { openInMaps } from '../lib/maps-utils';
import { WeatherBadge, getWeatherIcon, getWeatherDescKey } from './WeatherWidget';
import type { Event } from '../services/events';
import type { WeatherData } from '../services/weather';

const MEMBER_COLORS = ['#60A5FA', '#F59E0B', '#F472B6', '#34D399', '#A78BFA', '#FB7185'];

const STATUS_COLORS: Record<string, string> = {
  pending: '#F59E0B',
  confirmed: '#34D399',
  cancelled: '#FB7185',
};

interface EventCardProps {
  event: Event;
  groupId: string;
  memberColorMap: Map<string, string>;
  weather?: WeatherData[];
  onEdit?: (event: Event) => void;
  onDelete?: (event: Event) => void;
  onCancel?: (event: Event) => void;
}

export function EventCard({ event, groupId, memberColorMap, weather, onEdit, onDelete, onCancel }: EventCardProps) {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const respondEvent = useRespondEvent(groupId);
  const [showWeatherDetail, setShowWeatherDetail] = useState(false);

  const isResponding = respondEvent.isPending;

  // Format date
  const dateKey = apiDateToKey(event.date);
  const today = formatDateKey(new Date());
  const isPastEvent = dateKey < today;
  const dateObj = new Date(dateKey + 'T00:00:00');
  const locale = i18n.language === 'es' ? 'es-ES' : 'en-US';
  const formattedDate = dateObj.toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  // Format time
  const startTime = event.time ? event.time.slice(0, 5) : null;
  const endTime = event.endTime ? event.endTime.slice(0, 5) : null;
  const formattedTime = startTime && endTime ? `${startTime} - ${endTime}` : startTime;

  // Attendees
  const confirmedAttendees = event.attendees.filter((a) => a.status === 'confirmed');
  const declinedAttendees = event.attendees.filter((a) => a.status === 'declined');
  const totalAttendees = event.attendees.length;

  // Current user's attendee status
  const myAttendee = event.attendees.find((a) => a.userId === user?.id);
  const myStatus = myAttendee?.status ?? 'pending';
  const isPending = myStatus === 'pending';

  const isCreator = event.createdBy.id === user?.id;

  const handleRespond = (status: 'confirmed' | 'declined') => {
    respondEvent.mutate({ eventId: event.id, status });
  };

  return (
    <Card className="!p-4">
      {/* Header: title + badge + edit */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-[15px] font-bold text-text leading-snug flex-1">
          {event.title}
        </h4>
        <div className="flex items-center gap-1.5">
          {isCreator && onEdit && (
            <button
              onClick={() => onEdit(event)}
              className="p-1 rounded-md border-none bg-transparent"
              title={t('plans.editButton')}
            >
              <HiOutlinePencil className="w-4 h-4 text-text-muted" />
            </button>
          )}
          <Badge color={STATUS_COLORS[event.status]}>
            {t(`plans.status.${event.status}`)}
          </Badge>
        </div>
      </div>

      {/* Date & time + weather badge */}
      <div className="flex items-center gap-3 text-xs text-text-muted mb-1.5">
        <span className="capitalize">{formattedDate}</span>
        {formattedTime && (
          <span className="flex items-center gap-0.5">
            <HiOutlineClock className="w-3.5 h-3.5" />
            {formattedTime}
          </span>
        )}
        {weather && weather.length > 0 && (
          <button
            onClick={() => setShowWeatherDetail((prev) => !prev)}
            className="inline-flex items-center gap-0.5 text-[10px] text-text-muted bg-transparent border-none p-0 cursor-pointer"
            aria-label={t('weather.showDetail')}
            aria-expanded={showWeatherDetail}
          >
            <WeatherBadge weatherCode={weather[0].weatherCode} tempMax={weather[0].tempMax} />
          </button>
        )}
      </div>

      {/* Weather detail panel (all cities) */}
      {showWeatherDetail && weather && weather.length > 0 && (
        <div
          className="rounded-[10px] px-2.5 py-2 mb-1.5 space-y-0.5"
          style={{
            background: 'var(--app-bg-hover)',
            border: '1px solid var(--app-border)',
          }}
        >
          {weather.map((w) => (
            <div key={w.city} className="flex items-center gap-1.5 text-[11px] text-text-muted">
              <span>{getWeatherIcon(w.weatherCode)}</span>
              <span className="font-semibold text-text">{w.city}:</span>
              <span>{Math.round(w.tempMax)}° / {Math.round(w.tempMin)}°</span>
              <span className="text-text-dark">- {t(getWeatherDescKey(w.weatherCode))}</span>
            </div>
          ))}
        </div>
      )}

      {/* Location */}
      {event.location && (
        <button
          onClick={() => openInMaps(event.location!)}
          className="flex items-center gap-1 text-xs text-primary mb-1.5 bg-transparent border-none p-0 cursor-pointer underline-offset-2 hover:underline"
        >
          <HiOutlineMapPin className="w-3.5 h-3.5 shrink-0" />
          <span>{event.location}</span>
        </button>
      )}

      {/* Description */}
      {event.description && (
        <p className="text-xs text-text-dark mb-2 line-clamp-2">
          {event.description}
        </p>
      )}

      {/* Attendees summary */}
      <div className="mt-2.5 space-y-2">
        {/* Confirmed */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-success font-semibold">
            {confirmedAttendees.length}/{totalAttendees}
          </span>
          <AvatarStack
            size={22}
            members={confirmedAttendees.map((a) => ({
              name: a.user.name,
              color: memberColorMap.get(a.userId) ?? MEMBER_COLORS[0],
            }))}
          />
        </div>

        {/* Declined */}
        {declinedAttendees.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-danger font-semibold">
              {declinedAttendees.length}/{totalAttendees}
            </span>
            <AvatarStack
              size={22}
              members={declinedAttendees.map((a) => ({
                name: a.user.name,
                color: memberColorMap.get(a.userId) ?? MEMBER_COLORS[0],
              }))}
            />
          </div>
        )}
      </div>

      {/* Respond buttons */}
      {isPending && event.status !== 'cancelled' && (
        <div className="flex gap-2 mt-3">
          <Button
            onClick={() => handleRespond('confirmed')}
            disabled={isResponding}
            className="flex-1 !py-2 !text-xs"
          >
            {t('plans.confirm')}
          </Button>
          <button
            onClick={() => handleRespond('declined')}
            disabled={isResponding}
            className="flex-1 py-2 rounded-btn text-xs font-semibold transition-colors"
            style={{
              background: 'var(--app-bg-hover)',
              color: '#FB7185',
              border: '1px solid rgba(251,113,133,0.15)',
            }}
          >
            {t('plans.decline')}
          </button>
        </div>
      )}

      {/* User response status — clickable to toggle */}
      {!isPending && myAttendee && event.status !== 'cancelled' && (
        <div className="mt-3">
          <button
            onClick={
              !isPastEvent
                ? () => handleRespond(myStatus === 'confirmed' ? 'declined' : 'confirmed')
                : undefined
            }
            disabled={isResponding || isPastEvent}
            className="w-full py-2 rounded-btn text-xs font-semibold text-center border transition-opacity"
            style={{
              background: myStatus === 'confirmed' ? 'rgba(52,211,153,0.1)' : 'rgba(251,113,133,0.1)',
              color: myStatus === 'confirmed' ? '#34D399' : '#FB7185',
              borderColor: myStatus === 'confirmed' ? 'rgba(52,211,153,0.15)' : 'rgba(251,113,133,0.15)',
              cursor: isPastEvent ? 'default' : 'pointer',
              opacity: isResponding ? 0.6 : 1,
            }}
          >
            {myStatus === 'confirmed' ? t('plans.youConfirmed') : t('plans.youDeclined')}
          </button>
          {!isPastEvent && (
            <p className="text-[10px] text-text-dark text-center mt-1">
              {t('plans.tapToChange')}
            </p>
          )}
        </div>
      )}

      {/* Creator actions: delete + cancel */}
      {isCreator && (
        <div className="flex gap-2 mt-3">
          {onDelete && (
            <button
              onClick={() => onDelete(event)}
              className="flex-1 py-2 rounded-btn text-xs font-semibold transition-colors border-none"
              style={{
                background: 'rgba(251,113,133,0.08)',
                color: '#FB7185',
              }}
            >
              {t('plans.deleteEvent')}
            </button>
          )}
          {onCancel && isPastEvent === false && event.status !== 'cancelled' && (
            <button
              onClick={() => onCancel(event)}
              className="flex-1 py-2 rounded-btn text-xs font-semibold transition-colors border-none"
              style={{
                background: 'var(--app-bg-hover)',
                color: 'var(--app-text-muted)',
              }}
            >
              {t('plans.cancelEvent')}
            </button>
          )}
        </div>
      )}
    </Card>
  );
}
