import { useTranslation } from 'react-i18next';
import { formatDateKey, parseDateKey } from '../lib/date-utils';
import { AvatarStack } from '../ui/AvatarStack';
import type { Availability } from '../services/availability';

interface MemberInfo {
  name: string;
  color: string;
}

interface ListViewProps {
  availabilityByDate: Map<string, Availability[]>;
  memberColorMap: Map<string, string>;
  totalMembers: number;
  bestDayKey: string | null;
  onSelectDay: (day: Date) => void;
}

export function ListView({
  availabilityByDate,
  memberColorMap,
  totalMembers,
  bestDayKey,
  onSelectDay,
}: ListViewProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'es' ? 'es-ES' : 'en-US';
  const todayKey = formatDateKey(new Date());

  // Collect all future dates with availability, sorted
  const daysWithAvail = Array.from(availabilityByDate.entries())
    .filter(([dateKey]) => dateKey >= todayKey)
    .sort(([a], [b]) => a.localeCompare(b));

  return (
    <div>
      <div className="text-[11px] text-text-dark font-medium mb-1.5">
        {t('calendar.daysWithAvailability')}
      </div>

      {daysWithAvail.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-text-dark text-sm">{t('calendar.noAvailability')}</p>
        </div>
      ) : (
        daysWithAvail.map(([dateKey, dayAvail]) => {
          const isBest = dateKey === bestDayKey;
          const day = parseDateKey(dateKey);

          const members: MemberInfo[] = dayAvail.map((a) => ({
            name: a.user?.name ?? '?',
            color: memberColorMap.get(a.userId) ?? '#60A5FA',
          }));

          return (
            <div
              key={dateKey}
              onClick={() => onSelectDay(day)}
              className="rounded-card mb-1.5 cursor-pointer flex items-center justify-between"
              style={{
                padding: '12px 14px',
                background: 'var(--app-bg-card)',
                border: `1px solid ${isBest ? 'rgba(96,165,250,0.12)' : 'var(--app-border)'}`,
              }}
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-semibold text-text capitalize">
                    {day.toLocaleDateString(locale, {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                  {isBest && (
                    <span
                      className="text-[10px] font-bold tracking-wide px-2 py-0.5 rounded-[7px]"
                      style={{
                        background: 'rgba(96,165,250,0.12)',
                        color: '#60A5FA',
                      }}
                    >
                      {t('calendar.recommended')}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <AvatarStack members={members} size={16} />
                  <span className="text-[10px] text-text-dark">
                    {members.length}/{totalMembers}
                  </span>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
