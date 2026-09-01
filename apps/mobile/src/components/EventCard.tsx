import { useState } from 'react';
import { motion } from 'framer-motion';
import { IonSpinner } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { Badge } from '../ui/Badge';
import { Aro, type AroMember } from '../ui/Aro';
import { Button } from '../ui/Button';
import {
  HiOutlineMapPin,
  HiOutlinePencil,
  HiOutlineVideoCamera,
  HiOutlineArrowDownTray,
  HiOutlineShare,
} from 'react-icons/hi2';
import { useRespondEvent } from '../hooks/useEvents';
import { useGroupInvite } from '../hooks/useGroups';
import { useToast } from '../hooks/useToast';
import { useAnalytics } from '../hooks/useAnalytics';
import { spring, useMotionSafe } from '../lib/motion';
import { useAuthStore } from '../stores/auth';
import { useThemeStore } from '../stores/theme';
import { apiDateToKey, formatDateKey } from '../lib/date-utils';
import { openInMaps, hasCoordinates } from '../lib/maps-utils';
import { sanitizeUrl } from '../lib/url-utils';
import { downloadICS } from '../lib/ics-utils';
import { runWithErrorToast } from '../lib/mutation-utils';
import { renderTarjetaSellada } from '../lib/tarjeta';
import { shareTarjeta } from '../lib/share-tarjeta';
import { getWeatherIcon, getWeatherDescKey } from './WeatherWidget';
import type { Event, EventStatus } from '../services/events';
import type { WeatherData } from '../services/weather';

const STATUS_BADGE_VARIANT: Record<EventStatus, 'pending' | 'confirmed' | 'cancelled'> = {
  pending: 'pending',
  confirmed: 'confirmed',
  cancelled: 'cancelled',
};

interface EventCardProps {
  event: Event;
  groupId: string;
  memberColorMap: Map<string, string>;
  weather?: WeatherData[];
  onEdit?: (event: Event) => void;
  onDelete?: (event: Event) => void;
  onCancel?: (event: Event) => void;
  onConfirm?: (event: Event) => void;
  isDeleting?: boolean;
  isCancelling?: boolean;
  isConfirming?: boolean;
}

export function EventCard({
  event,
  groupId,
  memberColorMap,
  weather,
  onEdit,
  onDelete,
  onCancel,
  onConfirm,
  isDeleting,
  isCancelling,
  isConfirming,
}: EventCardProps) {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const respondEvent = useRespondEvent(groupId);
  const motionSafe = useMotionSafe();
  const { data: invite } = useGroupInvite(groupId);
  const darkMode = useThemeStore((s) => s.darkMode);
  const { showError, showInfo } = useToast();
  const { track } = useAnalytics();
  const [showWeatherDetail, setShowWeatherDetail] = useState(false);
  const [justConfirmed, setJustConfirmed] = useState(false);
  const [sharing, setSharing] = useState(false);

  const isResponding = respondEvent.isPending;

  // Format date
  const dateKey = apiDateToKey(event.date);
  const today = formatDateKey(new Date());
  const isPastEvent = dateKey < today;
  const dateObj = new Date(dateKey + 'T00:00:00');
  const locale = i18n.language === 'es' ? 'es-ES' : 'en-US';
  const weekdayShort = dateObj
    .toLocaleDateString(locale, { weekday: 'short' })
    .replace('.', '')
    .toUpperCase();

  // Format time
  const startTime = event.time ? event.time.slice(0, 5) : null;
  const endTime = event.endTime ? event.endTime.slice(0, 5) : null;
  const formattedTime = startTime && endTime ? `${startTime} - ${endTime}` : startTime;

  // Attendees
  const confirmedAttendees = event.attendees.filter((a) => a.status === 'confirmed');
  const totalAttendees = event.attendees.length;
  const missingCount = Math.max(totalAttendees - confirmedAttendees.length, 0);

  // Current user's attendee status
  const myAttendee = event.attendees.find((a) => a.userId === user?.id);
  const myStatus = myAttendee?.status ?? 'pending';
  const isInvited = !!myAttendee;
  const isPending = isInvited && myStatus === 'pending';

  const isCreator = event.createdBy.id === user?.id;

  // Ring of every group member in fixed slot order (same order as memberColorMap)
  const confirmedUserIds = new Set(confirmedAttendees.map((a) => a.userId));
  const attendeeRing: AroMember[] = [...memberColorMap.entries()].map(([userId, color]) => ({
    color,
    state: confirmedUserIds.has(userId) ? 'on' : 'off',
  }));
  // Sealed-card ring: only the people who confirmed, in slot order (falls back to the
  // full group in the unlikely case an event is confirmed with no confirmed attendee
  // rows, so the card never ships with an empty ring).
  const confirmedMemberColors = [...memberColorMap.entries()]
    .filter(([userId]) => confirmedUserIds.has(userId))
    .map(([, color]) => color);
  const selladaMemberColors =
    confirmedMemberColors.length > 0 ? confirmedMemberColors : [...memberColorMap.values()];

  const handleRespond = (status: 'confirmed' | 'declined') => {
    respondEvent.mutate(
      { eventId: event.id, status },
      {
        onSuccess: () => {
          if (status === 'confirmed') {
            setJustConfirmed(true);
          }
        },
      },
    );
  };

  const handleShare = async () => {
    if (sharing) return;
    if (!invite?.inviteUrl) return;
    const theme: 'dia' | 'noche' = darkMode ? 'noche' : 'dia';
    const weekdayFull = dateObj.toLocaleDateString(locale, { weekday: 'long' });
    const fechaHora = `${weekdayFull} ${dateObj.getDate()}${formattedTime ? ` · ${formattedTime}` : ''}`;

    setSharing(true);
    try {
      await runWithErrorToast(
        async () => {
          const blob = await renderTarjetaSellada({
            titulo: t('share.cardSellada'),
            plan: event.title,
            fechaHora,
            memberColors: selladaMemberColors,
            theme,
            marca: t('landing.brand'),
            pie: invite.inviteUrl.replace(/^https?:\/\//, ''),
          });
          const texto = t('share.tarjetaSellada', { titulo: event.title, fechaHora });
          const { shared } = await shareTarjeta({
            blob,
            texto,
            inviteUrl: invite.inviteUrl,
            filename: 'quedamos-tarjeta.png',
            showInfo,
          });
          if (shared) {
            track('share_tarjeta', { momento: 'sellada' });
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
    <div className="border-t border-subtle py-4">
      {/* Header: attendee ring + title + meta + badge/actions */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <motion.div
            animate={motionSafe && justConfirmed ? { scale: [1, 1.06, 1] } : undefined}
            transition={spring.bouncy}
          >
            <Aro data-testid="attendee-ring" members={attendeeRing} size={42}>
              {event.status === 'confirmed' ? (
                <svg
                  data-testid="attendee-ring-check"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-4 h-4 text-success"
                  aria-hidden="true"
                >
                  <polyline points="4 12 9 17 20 6" />
                </svg>
              ) : undefined}
            </Aro>
          </motion.div>
          <div className="min-w-0 flex-1">
            <h4 className="text-[17px] font-bold text-text leading-snug flex items-center gap-1.5">
              <span className="truncate">{event.title}</span>
              {event.isOnline && <HiOutlineVideoCamera className="w-4 h-4 text-primary shrink-0" />}
            </h4>
            <p className="font-mono text-[11px] text-text-muted flex items-center gap-1 mt-0.5">
              <span>
                {weekdayShort} {dateObj.getDate()}
              </span>
              {formattedTime && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{formattedTime}</span>
                </>
              )}
              {!event.isOnline && weather && weather.length > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <button
                    onClick={() => setShowWeatherDetail((prev) => !prev)}
                    className="font-mono text-[11px] text-text-muted underline-offset-2 hover:underline bg-transparent border-none p-0 cursor-pointer"
                    aria-label={t('weather.showDetail')}
                    aria-expanded={showWeatherDetail}
                  >
                    {Math.round(weather[0].tempMax)}°
                  </button>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => downloadICS(event)}
            className="p-2 -m-1 rounded-lg border-none bg-transparent active:bg-bg-hover transition-colors"
            title={t('calendar.eventDetail.download')}
            aria-label={t('calendar.eventDetail.download')}
          >
            <HiOutlineArrowDownTray className="w-4 h-4 text-text-muted" />
          </button>
          {isCreator && onEdit && (
            <button
              onClick={() => onEdit(event)}
              className="p-2 -m-1 rounded-lg border-none bg-transparent active:bg-bg-hover transition-colors"
              title={t('plans.editButton')}
              aria-label={t('plans.editButton')}
            >
              <HiOutlinePencil className="w-4 h-4 text-text-muted" />
            </button>
          )}
          {event.status === 'confirmed' && (
            <motion.button
              initial={motionSafe && justConfirmed ? { scale: 0, opacity: 0 } : false}
              animate={{ scale: 1, opacity: 1 }}
              transition={spring.bouncy}
              onClick={handleShare}
              disabled={sharing}
              className="p-2 -m-1 rounded-lg border-none bg-transparent active:bg-bg-hover transition-colors disabled:opacity-40 disabled:pointer-events-none"
              title={t('group.share')}
              aria-label={t('group.share')}
            >
              <HiOutlineShare className="w-4 h-4 text-text-muted" />
            </motion.button>
          )}
          <Badge variant={STATUS_BADGE_VARIANT[event.status]}>
            {t(`plans.status.${event.status}`)}
          </Badge>
        </div>
      </div>

      {/* Weather detail panel (all cities) */}
      {!event.isOnline && showWeatherDetail && weather && weather.length > 0 && (
        <div
          className="rounded-[10px] px-2.5 py-2 mt-2 space-y-0.5"
          style={{
            background: 'var(--app-bg-hover)',
            border: '1px solid var(--app-border)',
          }}
        >
          {weather.map((w) => (
            <div key={w.city} className="flex items-center gap-1.5 text-[11px] text-text-muted">
              <span>{getWeatherIcon(w.weatherCode)}</span>
              <span className="font-semibold text-text">{w.city}:</span>
              <span>
                {Math.round(w.tempMax)}° / {Math.round(w.tempMin)}°
              </span>
              <span className="text-text-dark">- {t(getWeatherDescKey(w.weatherCode))}</span>
            </div>
          ))}
        </div>
      )}

      {/* Location or Meeting URL */}
      {event.isOnline
        ? sanitizeUrl(event.meetingUrl) && (
            <a
              href={sanitizeUrl(event.meetingUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-primary mt-2 underline-offset-2 hover:underline"
            >
              <HiOutlineVideoCamera className="w-3.5 h-3.5 shrink-0" />
              <span>{t('online.joinMeeting')}</span>
            </a>
          )
        : event.location &&
          (hasCoordinates(event.locationLat, event.locationLon) ? (
            <button
              onClick={() => openInMaps(event.location!, event.locationLat, event.locationLon)}
              className="flex items-center gap-1 text-xs text-primary mt-2 bg-transparent border-none p-0 cursor-pointer underline-offset-2 hover:underline"
            >
              <HiOutlineMapPin className="w-3.5 h-3.5 shrink-0" />
              <span>{event.location}</span>
            </button>
          ) : (
            <div className="flex items-center gap-1 text-xs text-text-muted mt-2">
              <HiOutlineMapPin className="w-3.5 h-3.5 shrink-0" />
              <span>{event.location}</span>
            </div>
          ))}

      {/* Description */}
      {event.description && (
        <p className="text-xs text-text-dark mt-2 line-clamp-2">{event.description}</p>
      )}

      {/* Going count */}
      <p className="font-mono text-[11px] text-text-muted mt-2.5">
        {t('plans.goingCount', { confirmed: confirmedAttendees.length, missing: missingCount })}
      </p>

      {/* Respond buttons */}
      {isPending && event.status !== 'cancelled' && (
        <div className="flex gap-2 mt-3">
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleRespond('confirmed')}
            disabled={isResponding}
            className="flex-1"
          >
            {t('plans.confirm')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleRespond('declined')}
            disabled={isResponding}
            className="flex-1"
          >
            {t('plans.decline')}
          </Button>
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
            className={`w-full py-2 rounded-btn text-xs font-semibold text-center border transition-opacity ${
              myStatus === 'confirmed'
                ? 'bg-success-tint text-success border-subtle'
                : 'bg-error-tint text-error border-subtle'
            }`}
            style={{
              cursor: isPastEvent ? 'default' : 'pointer',
              opacity: isResponding ? 0.6 : 1,
            }}
          >
            {myStatus === 'confirmed' ? t('plans.youConfirmed') : t('plans.youDeclined')}
          </button>
          {!isPastEvent && (
            <p className="text-[10px] text-text-dark text-center mt-1">{t('plans.tapToChange')}</p>
          )}
        </div>
      )}

      {/* Creator actions: confirm + delete + cancel */}
      {isCreator && (
        <div className="flex gap-2 mt-3">
          {onConfirm && isPastEvent === false && event.status === 'pending' && (
            <button
              onClick={() => onConfirm(event)}
              disabled={isConfirming}
              className="flex-1 py-2 rounded-btn text-xs font-semibold transition-colors border-none inline-flex items-center justify-center gap-1.5 bg-success-tint text-success"
              style={{ opacity: isConfirming ? 0.5 : 1 }}
            >
              {isConfirming && <IonSpinner name="crescent" className="w-3 h-3 shrink-0" />}
              {t('plans.confirmEvent')}
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(event)}
              disabled={isDeleting}
              className="flex-1 py-2 rounded-btn text-xs font-semibold transition-colors border-none inline-flex items-center justify-center gap-1.5 bg-error-tint text-error"
              style={{ opacity: isDeleting ? 0.5 : 1 }}
            >
              {isDeleting && <IonSpinner name="crescent" className="w-3 h-3 shrink-0" />}
              {t('plans.deleteEvent')}
            </button>
          )}
          {onCancel && isPastEvent === false && event.status !== 'cancelled' && (
            <button
              onClick={() => onCancel(event)}
              disabled={isCancelling}
              className="flex-1 py-2 rounded-btn text-xs font-semibold transition-colors border-none inline-flex items-center justify-center gap-1.5 bg-bg-hover text-text-muted"
              style={{ opacity: isCancelling ? 0.5 : 1 }}
            >
              {isCancelling && <IonSpinner name="crescent" className="w-3 h-3 shrink-0" />}
              {t('plans.cancelEvent')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
