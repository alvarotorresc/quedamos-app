import { IonModal } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { HiOutlineMapPin, HiOutlineClock } from 'react-icons/hi2';
import { Badge } from '../ui/Badge';
import { AvatarStack } from '../ui/AvatarStack';
import { openInMaps } from '../lib/maps-utils';
import { apiDateToKey } from '../lib/date-utils';
import type { Event } from '../services/events';

const MEMBER_COLORS = ['#60A5FA', '#F59E0B', '#F472B6', '#34D399', '#A78BFA', '#FB7185'];

const STATUS_COLORS: Record<string, string> = {
  pending: '#F59E0B',
  confirmed: '#34D399',
  cancelled: '#FB7185',
};

interface EventDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: Event | null;
  memberColorMap?: Map<string, string>;
}

export function EventDetailModal({
  isOpen,
  onClose,
  event,
  memberColorMap,
}: EventDetailModalProps) {
  const { t, i18n } = useTranslation();

  if (!event) return null;

  const dateKey = apiDateToKey(event.date);
  const dateObj = new Date(dateKey + 'T00:00:00');
  const locale = i18n.language === 'es' ? 'es-ES' : 'en-US';
  const formattedDate = dateObj.toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const startTime = event.time ? event.time.slice(0, 5) : null;
  const endTime = event.endTime ? event.endTime.slice(0, 5) : null;
  const formattedTime = startTime && endTime ? `${startTime} - ${endTime}` : startTime;

  const confirmedAttendees = event.attendees.filter((a) => a.status === 'confirmed');
  const declinedAttendees = event.attendees.filter((a) => a.status === 'declined');
  const pendingAttendees = event.attendees.filter((a) => a.status === 'pending');

  const getColor = (userId: string) => memberColorMap?.get(userId) ?? MEMBER_COLORS[0];

  return (
    <IonModal
      isOpen={isOpen}
      onDidDismiss={onClose}
      breakpoints={[0, 0.6, 1]}
      initialBreakpoint={0.6}
    >
      <div className="px-5 pt-5 pb-9 bg-bg-light">
        <div className="w-8 h-[3px] rounded-sm bg-toggle-off mx-auto mb-3.5" />

        <div className="flex items-start justify-between gap-2 mb-3">
          <h3 className="text-[17px] font-bold text-text">{event.title}</h3>
          <Badge color={STATUS_COLORS[event.status]}>{t(`plans.status.${event.status}`)}</Badge>
        </div>

        <div className="flex items-center gap-3 text-xs text-text-muted mb-2">
          <span className="capitalize">{formattedDate}</span>
          {formattedTime && (
            <span className="flex items-center gap-0.5">
              <HiOutlineClock className="w-3.5 h-3.5" />
              {formattedTime}
            </span>
          )}
        </div>

        {event.location && (
          <button
            onClick={() => openInMaps(event.location!)}
            className="flex items-center gap-1 text-xs text-primary mb-2 bg-transparent border-none p-0 cursor-pointer underline-offset-2 hover:underline"
          >
            <HiOutlineMapPin className="w-3.5 h-3.5 shrink-0" />
            <span>{event.location}</span>
          </button>
        )}

        {event.description && <p className="text-xs text-text-dark mb-3">{event.description}</p>}

        <div className="space-y-3 mt-4">
          {confirmedAttendees.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-success mb-1">
                {t('plans.confirm')} ({confirmedAttendees.length})
              </p>
              <AvatarStack
                size={24}
                members={confirmedAttendees.map((a) => ({
                  name: a.user.name,
                  color: getColor(a.userId),
                }))}
              />
              <p className="text-[10px] text-text-dark mt-0.5">
                {confirmedAttendees.map((a) => a.user.name).join(', ')}
              </p>
            </div>
          )}

          {pendingAttendees.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-warning mb-1">
                {t('plans.status.pending')} ({pendingAttendees.length})
              </p>
              <AvatarStack
                size={24}
                members={pendingAttendees.map((a) => ({
                  name: a.user.name,
                  color: getColor(a.userId),
                }))}
              />
              <p className="text-[10px] text-text-dark mt-0.5">
                {pendingAttendees.map((a) => a.user.name).join(', ')}
              </p>
            </div>
          )}

          {declinedAttendees.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-danger mb-1">
                {t('plans.decline')} ({declinedAttendees.length})
              </p>
              <AvatarStack
                size={24}
                members={declinedAttendees.map((a) => ({
                  name: a.user.name,
                  color: getColor(a.userId),
                }))}
              />
              <p className="text-[10px] text-text-dark mt-0.5">
                {declinedAttendees.map((a) => a.user.name).join(', ')}
              </p>
            </div>
          )}
        </div>

        <p className="text-[10px] text-text-dark mt-4">
          {t('calendar.eventDetail.createdBy', { name: event.createdBy.name })}
        </p>
      </div>
    </IonModal>
  );
}
