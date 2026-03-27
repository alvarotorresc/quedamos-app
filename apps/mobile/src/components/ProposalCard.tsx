import { useMemo } from 'react';
import { IonSpinner } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { HiOutlineCheck, HiOutlineXMark, HiOutlinePencil } from 'react-icons/hi2';
import { useAuthStore } from '../stores/auth';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { AvatarStack } from '../ui/AvatarStack';
import { WeatherBadge } from './WeatherWidget';
import type { Proposal } from '../services/proposals';
import type { WeatherData } from '../services/weather';
import { MEMBER_COLORS } from '../lib/constants';

interface ProposalCardProps {
  proposal: Proposal;
  onVote: (proposalId: string, vote: 'yes' | 'no') => void;
  onConvert?: (proposal: Proposal) => void;
  onClose?: (proposalId: string) => void;
  onEdit?: (proposal: Proposal) => void;
  isVoting?: boolean;
  isClosing?: boolean;
  memberColorMap?: Map<string, string>;
  weather?: WeatherData[];
}

export function ProposalCard({
  proposal,
  onVote,
  onConvert,
  onClose,
  onEdit,
  isVoting,
  isClosing,
  memberColorMap,
  weather,
}: ProposalCardProps) {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const isCreator = proposal.createdBy.id === user?.id;

  const { yesVoters, noVoters, yesCount, noCount, total, myVote } = useMemo(() => {
    const yv: { name: string; color: string }[] = [];
    const nv: { name: string; color: string }[] = [];
    let mine: 'yes' | 'no' | null = null;
    for (const v of proposal.votes) {
      const color = memberColorMap?.get(v.userId) ?? MEMBER_COLORS[0];
      const entry = { name: v.user?.name ?? '?', color };
      if (v.vote === 'yes') yv.push(entry);
      else nv.push(entry);
      if (v.userId === user?.id) mine = v.vote;
    }
    return {
      yesVoters: yv,
      noVoters: nv,
      yesCount: yv.length,
      noCount: nv.length,
      total: yv.length + nv.length,
      myVote: mine,
    };
  }, [proposal.votes, user?.id, memberColorMap]);

  const yesPercent = total > 0 ? Math.round((yesCount / total) * 100) : 0;
  const noPercent = total > 0 ? Math.round((noCount / total) * 100) : 0;

  const formattedProposedDate = useMemo(() => {
    if (!proposal.proposedDate) return null;
    const date = new Date(proposal.proposedDate + 'T00:00:00');
    return date.toLocaleDateString(i18n.language, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  }, [proposal.proposedDate, i18n.language]);

  const isOpen = proposal.status === 'open';

  const statusColor =
    proposal.status === 'converted'
      ? '#34D399'
      : proposal.status === 'closed'
        ? '#94A3B8'
        : '#60A5FA';

  return (
    <Card variant="default" className="!p-3.5">
      {/* Header */}
      <div className="flex items-start justify-between mb-1.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h4 className="text-sm font-bold text-text truncate">{proposal.title}</h4>
            {isCreator && isOpen && onEdit && (
              <button
                onClick={() => onEdit(proposal)}
                className="shrink-0 p-1 rounded-md border-none"
                style={{ background: 'transparent', color: 'var(--app-text-dark)' }}
                aria-label={t('proposals.edit')}
              >
                <HiOutlinePencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <p className="text-[11px] text-text-dark">
            {proposal.createdBy.name} · {t(`proposals.status.${proposal.status}`)}
          </p>
        </div>
        <Badge color={statusColor}>{t(`proposals.status.${proposal.status}`)}</Badge>
      </div>

      {/* Description */}
      {proposal.description && (
        <p className="text-xs text-text-muted mb-2">{proposal.description}</p>
      )}

      {/* Location */}
      {proposal.location && (
        <p className="text-[11px] text-text-dark mb-2">📍 {proposal.location}</p>
      )}

      {/* Proposed Date + Weather */}
      {proposal.proposedDate && (
        <div className="flex items-center gap-2 text-[11px] text-text-dark mb-2">
          <span>📅 {formattedProposedDate}</span>
          {weather && weather.length > 0 && (
            <WeatherBadge weatherCode={weather[0].weatherCode} tempMax={weather[0].tempMax} />
          )}
        </div>
      )}

      {/* Vote bar */}
      {total > 0 && (
        <div className="mb-2">
          <div
            className="flex rounded-full overflow-hidden h-2 mb-1"
            style={{ background: 'var(--app-bg-hover)' }}
          >
            {yesPercent > 0 && (
              <div
                className="h-full transition-all"
                style={{ width: `${yesPercent}%`, background: '#34D399' }}
              />
            )}
            {noPercent > 0 && (
              <div
                className="h-full transition-all"
                style={{ width: `${noPercent}%`, background: '#FB7185' }}
              />
            )}
          </div>
          <p className="text-[10px] text-text-dark">
            {t('proposals.votes', { yes: yesCount, no: noCount })}
          </p>
        </div>
      )}

      {/* Voters detail */}
      {total > 0 && (
        <div className="space-y-1.5 mb-2">
          {yesVoters.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold" style={{ color: '#34D399' }}>
                {yesCount}
              </span>
              <AvatarStack size={20} members={yesVoters} />
              <span className="text-[10px] text-text-dark truncate">
                {yesVoters.map((v) => v.name).join(', ')}
              </span>
            </div>
          )}
          {noVoters.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold" style={{ color: '#FB7185' }}>
                {noCount}
              </span>
              <AvatarStack size={20} members={noVoters} />
              <span className="text-[10px] text-text-dark truncate">
                {noVoters.map((v) => v.name).join(', ')}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      {isOpen && (
        <div className="flex items-center gap-2 mt-2">
          {/* Vote buttons */}
          <button
            onClick={() => onVote(proposal.id, 'yes')}
            disabled={isVoting}
            className="flex items-center gap-1 px-3 py-1.5 rounded-[10px] text-[11px] font-semibold border-none"
            style={{
              background: myVote === 'yes' ? 'rgba(52,211,153,0.15)' : 'var(--app-bg-hover)',
              color: myVote === 'yes' ? '#34D399' : 'var(--app-text-muted)',
              border:
                myVote === 'yes' ? '1px solid rgba(52,211,153,0.3)' : '1px solid var(--app-border)',
              opacity: isVoting ? 0.5 : 1,
            }}
          >
            {isVoting ? (
              <IonSpinner name="crescent" className="w-3 h-3 shrink-0" />
            ) : (
              <HiOutlineCheck className="w-3.5 h-3.5" />
            )}
            {t('proposals.voteYes')}
          </button>
          <button
            onClick={() => onVote(proposal.id, 'no')}
            disabled={isVoting}
            className="flex items-center gap-1 px-3 py-1.5 rounded-[10px] text-[11px] font-semibold border-none"
            style={{
              background: myVote === 'no' ? 'rgba(251,113,133,0.15)' : 'var(--app-bg-hover)',
              color: myVote === 'no' ? '#FB7185' : 'var(--app-text-muted)',
              border:
                myVote === 'no' ? '1px solid rgba(251,113,133,0.3)' : '1px solid var(--app-border)',
              opacity: isVoting ? 0.5 : 1,
            }}
          >
            {isVoting ? (
              <IonSpinner name="crescent" className="w-3 h-3 shrink-0" />
            ) : (
              <HiOutlineXMark className="w-3.5 h-3.5" />
            )}
            {t('proposals.voteNo')}
          </button>

          {/* Creator actions */}
          {isCreator && (
            <div className="flex items-center gap-1.5 ml-auto">
              <button
                onClick={() => onConvert?.(proposal)}
                className="px-2.5 py-1.5 rounded-[10px] text-[10px] font-semibold border-none"
                style={{
                  background: 'rgba(37,99,235,0.1)',
                  color: '#60A5FA',
                  border: '1px solid rgba(96,165,250,0.2)',
                }}
              >
                {t('proposals.convert')}
              </button>
              <button
                onClick={() => onClose?.(proposal.id)}
                disabled={isClosing}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[10px] text-[10px] font-semibold border-none"
                style={{
                  background: 'var(--app-bg-hover)',
                  color: 'var(--app-text-dark)',
                  border: '1px solid var(--app-border)',
                  opacity: isClosing ? 0.5 : 1,
                }}
              >
                {isClosing && <IonSpinner name="crescent" className="w-3 h-3 shrink-0" />}
                {t('proposals.close')}
              </button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
