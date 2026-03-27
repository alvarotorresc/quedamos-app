import { useTranslation } from 'react-i18next';
import { parseDateKey } from '../lib/date-utils';
import { Card } from '../ui/Card';

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
    <Card variant={isSecond ? 'default' : 'highlight'} className="cursor-pointer" onClick={onClick}>
      <div className="flex items-center gap-2.5">
        <span className="text-base">{isSecond ? '⭐' : '✨'}</span>
        <div className="flex-1 min-w-0">
          <div
            className={`text-[9px] font-extrabold tracking-wider uppercase ${
              isSecond
                ? 'text-text-muted'
                : 'bg-gradient-to-r from-[#A78BFA] to-[#F472B6] bg-clip-text text-transparent'
            }`}
          >
            {isSecond ? t('calendar.secondBestDay') : t('calendar.bestDay')}
          </div>
          <div className="text-text-muted text-xs mt-0.5 capitalize">
            {label} · {availableCount}/{totalMembers}
          </div>
        </div>
      </div>
    </Card>
  );
}
