import { useTranslation } from 'react-i18next';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { HiOutlineMapPin, HiOutlineClock, HiCheck, HiXMark, HiMinus } from 'react-icons/hi2';
import { useRespondEvent } from '../hooks/useEvents';
import { useAuthStore } from '../stores/auth';
import { apiDateToKey } from '../lib/date-utils';
import type { Event } from '../services/events';

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
}

export function EventCard({ event, groupId, memberColorMap }: EventCardProps) {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const respondEvent = useRespondEvent(groupId);

  const isResponding = respondEvent.isPending;

  // Format date
  const dateKey = apiDateToKey(event.date);
  const dateObj = new Date(dateKey + 'T00:00:00');
  const locale = i18n.language === 'es' ? 'es-ES' : 'en-US';
  const formattedDate = dateObj.toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  // Format time
  const formattedTime = event.time ? event.time.slice(0, 5) : null;

  // Attendees
  const confirmedAttendees = event.attendees.filter((a) => a.status === 'confirmed');
  const totalAttendees = event.attendees.length;

  // Current user's attendee status
  const myAttendee = event.attendees.find((a) => a.userId === user?.id);
  const myStatus = myAttendee?.status ?? 'pending';
  const isPending = myStatus === 'pending';

  const handleRespond = (status: 'confirmed' | 'declined') => {
    respondEvent.mutate({ eventId: event.id, status });
  };

  return (
    <Card className="!p-4">
      {/* Header: title + badge */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-[15px] font-bold text-text leading-snug flex-1">
          {event.title}
        </h4>
        <Badge color={STATUS_COLORS[event.status]}>
          {t(`plans.status.${event.status}`)}
        </Badge>
      </div>

      {/* Date & time */}
      <div className="flex items-center gap-3 text-xs text-text-muted mb-1.5">
        <span className="capitalize">{formattedDate}</span>
        {formattedTime && (
          <span className="flex items-center gap-0.5">
            <HiOutlineClock className="w-3.5 h-3.5" />
            {formattedTime}
          </span>
        )}
      </div>

      {/* Location */}
      {event.location && (
        <div className="flex items-center gap-1 text-xs text-text-muted mb-1.5">
          <HiOutlineMapPin className="w-3.5 h-3.5 shrink-0" />
          <span>{event.location}</span>
        </div>
      )}

      {/* Description */}
      {event.description && (
        <p className="text-xs text-text-dark mb-2 line-clamp-2">
          {event.description}
        </p>
      )}

      {/* Attendees list */}
      <div className="mt-2.5 space-y-1.5">
        <span className="text-[11px] text-text-dark font-semibold uppercase tracking-wider">
          {confirmedAttendees.length}/{totalAttendees} {t('plans.confirmed')}
        </span>
        {event.attendees.map((a) => {
          const color = memberColorMap.get(a.userId) ?? MEMBER_COLORS[0];
          const statusIcon = a.status === 'confirmed'
            ? <HiCheck className="w-3.5 h-3.5 text-success" />
            : a.status === 'declined'
            ? <HiXMark className="w-3.5 h-3.5 text-danger" />
            : <HiMinus className="w-3.5 h-3.5 text-text-dark" />;
          return (
            <div key={a.userId} className="flex items-center gap-2">
              <Avatar name={a.user.name} color={color} size={22} />
              <span className="text-xs text-text flex-1">{a.user.name}</span>
              {statusIcon}
            </div>
          );
        })}
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
              background: 'rgba(255,255,255,0.04)',
              color: '#FB7185',
              border: '1px solid rgba(251,113,133,0.15)',
            }}
          >
            {t('plans.decline')}
          </button>
        </div>
      )}

      {/* User response status */}
      {!isPending && myAttendee && event.status !== 'cancelled' && (
        <div
          className="mt-3 py-2 rounded-btn text-xs font-semibold text-center"
          style={{
            background: myStatus === 'confirmed' ? 'rgba(52,211,153,0.1)' : 'rgba(251,113,133,0.1)',
            color: myStatus === 'confirmed' ? '#34D399' : '#FB7185',
            border: `1px solid ${myStatus === 'confirmed' ? 'rgba(52,211,153,0.15)' : 'rgba(251,113,133,0.15)'}`,
          }}
        >
          {myStatus === 'confirmed' ? t('plans.youConfirmed') : t('plans.youDeclined')}
        </div>
      )}
    </Card>
  );
}
