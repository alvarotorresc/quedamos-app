import { IonModal } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { Avatar } from '../ui/Avatar';
import type { Availability } from '../services/availability';

interface AvailabilityDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDay: Date | null;
  availabilities: Availability[];
  memberColorMap: Map<string, string>;
  onMarkAvailability: () => void;
}

export function AvailabilityDetailModal({
  isOpen,
  onClose,
  selectedDay,
  availabilities,
  memberColorMap,
  onMarkAvailability,
}: AvailabilityDetailModalProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'es' ? 'es-ES' : 'en-US';

  const dateLabel = selectedDay?.toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  function getAvailLabel(a: Availability): string {
    if (a.type === 'day') return t('calendar.allDay');
    if (a.type === 'slots' && a.slots) {
      return a.slots
        .map((s) => {
          if (s === 'Mañana') return t('calendar.availability.morning');
          if (s === 'Tarde') return t('calendar.availability.afternoon');
          if (s === 'Noche') return t('calendar.availability.night');
          return s;
        })
        .join(', ');
    }
    if (a.type === 'range' && a.startTime && a.endTime) {
      return `${a.startTime.slice(0, 5)} – ${a.endTime.slice(0, 5)}`;
    }
    return '';
  }

  return (
    <IonModal
      isOpen={isOpen}
      onDidDismiss={onClose}
      breakpoints={[0, 1]}
      initialBreakpoint={1}
      className="availability-modal"
    >
      <div className="px-5 pt-5 pb-9 bg-bg-light">
        {/* Handle bar */}
        <div className="w-8 h-[3px] rounded-sm bg-white/10 mx-auto mb-3.5" />

        <h3 className="text-[17px] font-bold text-text mb-0.5">
          {t('calendar.availabilityDetail.title')}
        </h3>
        <p className="text-xs text-text-dark mb-4 capitalize">{dateLabel}</p>

        {availabilities.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-text-dark">{t('calendar.noAvailability')}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 mb-4">
            {availabilities.map((a) => {
              const color = memberColorMap.get(a.userId) ?? '#60A5FA';
              return (
                <div
                  key={a.id}
                  className="flex items-center gap-3 rounded-btn px-3.5 py-3"
                  style={{
                    background: 'rgba(255,255,255,0.025)',
                    border: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <Avatar name={a.user?.name ?? '?'} color={color} size={34} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text truncate">
                      {a.user?.name ?? '?'}
                    </p>
                    <p className="text-xs text-text-muted">{getAvailLabel(a)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <button
          onClick={() => {
            onClose();
            setTimeout(onMarkAvailability, 300);
          }}
          className="w-full py-2.5 text-xs font-semibold rounded-btn bg-primary-dark text-white border-none"
        >
          {t('calendar.markAvailable')}
        </button>
      </div>
    </IonModal>
  );
}
