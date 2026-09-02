import { useTranslation } from 'react-i18next';
import { capitalizeFirst } from '../lib/date-utils';
import { availabilityLabel } from '../lib/availability-label';
import { Avatar } from '../ui/Avatar';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';
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
    return availabilityLabel(a, t);
  }

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={t('calendar.availabilityDetail.title')}
      subtitle={capitalizeFirst(dateLabel)}
      footer={
        <Button
          size="sm"
          className="w-full"
          onClick={() => {
            onClose();
            setTimeout(onMarkAvailability, 300);
          }}
        >
          {t('calendar.markAvailable')}
        </Button>
      }
    >
        {availabilities.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-text-dark">{t('calendar.noAvailability')}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {availabilities.map((a) => {
              const color = memberColorMap.get(a.userId) ?? '#60A5FA';
              return (
                <div
                  key={a.id}
                  className="flex items-center gap-3 rounded-btn px-3.5 py-3"
                  style={{
                    background: 'var(--app-bg-card)',
                    border: '1px solid var(--app-border)',
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

    </Sheet>
  );
}
