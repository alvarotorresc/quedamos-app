import { useTranslation } from 'react-i18next';
import { parseDateKey } from '../lib/date-utils';

interface BestDayBannerProps {
  dateKey: string;
  availableCount: number;
  totalMembers: number;
  rank?: 1 | 2;
  onClick?: () => void;
}

export function BestDayBanner({
  dateKey,
  availableCount,
  totalMembers,
  rank = 1,
  onClick,
}: BestDayBannerProps) {
  const { t, i18n } = useTranslation();
  const date = parseDateKey(dateKey);
  const label = date.toLocaleDateString(i18n.language === 'es' ? 'es-ES' : 'en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });

  const isSecond = rank === 2;

  return (
    <div
      className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 mb-2"
      style={{
        background: isSecond ? 'rgba(148,163,184,0.06)' : 'rgba(37,99,235,0.06)',
        border: `1px solid ${isSecond ? 'rgba(148,163,184,0.1)' : 'rgba(96,165,250,0.1)'}`,
        cursor: onClick ? 'pointer' : undefined,
      }}
      onClick={onClick}
    >
      <span className="text-base">{isSecond ? '⭐' : '✨'}</span>
      <div className="flex-1 min-w-0">
        <div
          className="text-[9px] font-bold tracking-wider uppercase"
          style={{ color: isSecond ? '#94A3B8' : undefined }}
        >
          {isSecond ? t('calendar.secondBestDay') : t('calendar.bestDay')}
        </div>
        <div className="text-text-muted text-xs mt-0.5 capitalize">
          {label} · {availableCount}/{totalMembers}
        </div>
      </div>
    </div>
  );
}
