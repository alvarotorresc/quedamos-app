import { useTranslation } from 'react-i18next';
import { parseDateKey } from '../lib/date-utils';

interface BestDayBannerProps {
  dateKey: string;
  availableCount: number;
  totalMembers: number;
  onClick?: () => void;
}

export function BestDayBanner({ dateKey, availableCount, totalMembers, onClick }: BestDayBannerProps) {
  const { t, i18n } = useTranslation();
  const date = parseDateKey(dateKey);
  const label = date.toLocaleDateString(i18n.language === 'es' ? 'es-ES' : 'en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });

  return (
    <div
      className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 mb-2"
      style={{
        background: 'rgba(37,99,235,0.06)',
        border: '1px solid rgba(96,165,250,0.1)',
        cursor: onClick ? 'pointer' : undefined,
      }}
      onClick={onClick}
    >
      <span className="text-base">✨</span>
      <div className="flex-1 min-w-0">
        <div className="text-primary text-[9px] font-bold tracking-wider uppercase">
          {t('calendar.bestDay')}
        </div>
        <div className="text-text-muted text-xs mt-0.5 capitalize">
          {label} · {availableCount}/{totalMembers}
        </div>
      </div>
    </div>
  );
}
