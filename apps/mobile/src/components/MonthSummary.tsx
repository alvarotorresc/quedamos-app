import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getMonthCells, formatDateKey } from '../lib/date-utils';
import type { Availability } from '../services/availability';

interface MonthSummaryProps {
  monthOffset: number;
  availabilityByDate: Map<string, Availability[]>;
  totalMembers: number;
}

function InfoIcon({ color }: { color: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" stroke={color} strokeOpacity={0.5} strokeWidth="1.5" />
      <path d="M8 7v4" stroke={color} strokeOpacity={0.7} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="4.5" r="0.75" fill={color} fillOpacity={0.7} />
    </svg>
  );
}

export function MonthSummary({ monthOffset, availabilityByDate, totalMembers }: MonthSummaryProps) {
  const { t } = useTranslation();
  const { cells } = getMonthCells(new Date(), monthOffset);
  const [tooltip, setTooltip] = useState<string | null>(null);

  const todayKey = formatDateKey(new Date());

  const stats = useMemo(() => {
    const monthDays = cells.filter(Boolean) as Date[];
    const monthKeys = new Set(monthDays.map((d) => formatDateKey(d)));

    let daysActive = 0;
    let bestCount = 0;
    const uniqueUsers = new Set<string>();

    for (const [key, avails] of availabilityByDate) {
      if (!monthKeys.has(key)) continue;
      if (key < todayKey) continue;
      daysActive++;
      if (avails.length > bestCount) bestCount = avails.length;
      avails.forEach((a) => uniqueUsers.add(a.userId));
    }

    const coverage =
      totalMembers > 0 ? Math.round((bestCount / totalMembers) * 100) : 0;

    return { daysActive, coverage, activeMembers: uniqueUsers.size };
  }, [cells, availabilityByDate, totalMembers, todayKey]);

  if (stats.daysActive === 0) return null;

  const toggleTooltip = (key: string) => {
    setTooltip(tooltip === key ? null : key);
  };

  return (
    <div className="flex flex-col gap-2 mt-4">
      <div className="flex gap-2">
        {/* Active days */}
        <div
          className="flex-1 rounded-xl p-3 text-center relative"
          style={{
            background: 'rgba(96,165,250,0.08)',
            border: '1px solid rgba(96,165,250,0.12)',
          }}
        >
          <button
            type="button"
            onClick={() => toggleTooltip('days')}
            className="absolute top-2 right-2 bg-transparent border-none p-0 cursor-pointer"
          >
            <InfoIcon color="#60A5FA" />
          </button>
          <div className="text-xl font-bold text-primary">{stats.daysActive}</div>
          <div className="text-[10px] text-text-muted mt-0.5">
            {t('calendar.monthStats.activeDays')}
          </div>
        </div>

        {/* Best match */}
        <div
          className="flex-1 rounded-xl p-3 text-center relative"
          style={{
            background: 'rgba(52,211,153,0.08)',
            border: '1px solid rgba(52,211,153,0.12)',
          }}
        >
          <button
            type="button"
            onClick={() => toggleTooltip('match')}
            className="absolute top-2 right-2 bg-transparent border-none p-0 cursor-pointer"
          >
            <InfoIcon color="#34D399" />
          </button>
          <div className="text-xl font-bold" style={{ color: '#34D399' }}>
            {stats.coverage}%
          </div>
          <div className="text-[10px] text-text-muted mt-0.5">
            {t('calendar.monthStats.bestMatch')}
          </div>
        </div>

        {/* Active members */}
        <div
          className="flex-1 rounded-xl p-3 text-center relative"
          style={{
            background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.12)',
          }}
        >
          <button
            type="button"
            onClick={() => toggleTooltip('members')}
            className="absolute top-2 right-2 bg-transparent border-none p-0 cursor-pointer"
          >
            <InfoIcon color="#F59E0B" />
          </button>
          <div className="text-xl font-bold" style={{ color: '#F59E0B' }}>
            {stats.activeMembers}
          </div>
          <div className="text-[10px] text-text-muted mt-0.5">
            {t('calendar.monthStats.activeMembers')}
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="rounded-lg px-3 py-2 text-[11px] text-text-muted"
          style={{
            background: 'var(--app-bg-hover)',
            border: '1px solid var(--app-border-strong)',
          }}
        >
          {t(`calendar.monthStats.info.${tooltip}`)}
        </div>
      )}
    </div>
  );
}
