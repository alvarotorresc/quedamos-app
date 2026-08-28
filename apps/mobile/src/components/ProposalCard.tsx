import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  HiOutlineCheck,
  HiOutlineXMark,
  HiOutlinePencil,
  HiOutlineVideoCamera,
} from 'react-icons/hi2';
import { useAuthStore } from '../stores/auth';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { AvatarStack } from '../ui/AvatarStack';
import { WeatherBadge } from './WeatherWidget';
import type { Proposal } from '../services/proposals';
import type { WeatherData } from '../services/weather';
import { MEMBER_COLORS } from '../lib/constants';
import { sanitizeUrl } from '../lib/url-utils';

type ProposalBadgeVariant = 'neutral' | 'confirmed';

const STATUS_BADGE_VARIANT: Record<Proposal['status'], ProposalBadgeVariant> = {
  open: 'neutral',
  converted: 'confirmed',
  closed: 'neutral',
};

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

  return (
    <div className="border-t border-subtle py-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-1.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h4 className="text-[17px] font-bold text-text truncate flex items-center gap-1">
              {proposal.title}
              {proposal.isOnline && (
                <HiOutlineVideoCamera className="w-3.5 h-3.5 text-primary shrink-0" />
              )}
            </h4>
            {isCreator && isOpen && onEdit && (
              <button
                onClick={() => onEdit(proposal)}
                className="shrink-0 p-1 rounded-md border-none bg-transparent text-text-dark"
                aria-label={t('proposals.edit')}
              >
                <HiOutlinePencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <p className="font-mono text-[11px] text-text-muted">
            {proposal.createdBy.name} · {t(`proposals.status.${proposal.status}`)}
          </p>
        </div>
        <Badge variant={STATUS_BADGE_VARIANT[proposal.status]}>
          {t(`proposals.status.${proposal.status}`)}
        </Badge>
      </div>

      {/* Description */}
      {proposal.description && (
        <p className="text-xs text-text-muted mb-2">{proposal.description}</p>
      )}

      {/* Location or Meeting URL */}
      {proposal.isOnline && sanitizeUrl(proposal.meetingUrl) ? (
        <a
          href={sanitizeUrl(proposal.meetingUrl)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[11px] text-primary mb-2 underline-offset-2 hover:underline"
        >
          <HiOutlineVideoCamera className="w-3.5 h-3.5 shrink-0" />
          <span>{t('online.meetingLink')}</span>
        </a>
      ) : (
        !proposal.isOnline &&
        proposal.location && (
          <p className="text-[11px] text-text-dark mb-2">📍 {proposal.location}</p>
        )
      )}

      {/* Proposed Date + Weather */}
      {proposal.proposedDate && (
        <div className="flex items-center gap-2 text-[11px] text-text-dark mb-2">
          <span>📅 {formattedProposedDate}</span>
          {!proposal.isOnline && weather && weather.length > 0 && (
            <WeatherBadge weatherCode={weather[0].weatherCode} tempMax={weather[0].tempMax} />
          )}
        </div>
      )}

      {/* Vote bar */}
      {total > 0 && (
        <div className="mb-2">
          <div className="flex h-1 rounded-pill overflow-hidden bg-toggle-off mb-1">
            {yesPercent > 0 && (
              <div
                className="h-full bg-success transition-all"
                style={{ width: `${yesPercent}%` }}
              />
            )}
            {noPercent > 0 && (
              <div className="h-full bg-error transition-all" style={{ width: `${noPercent}%` }} />
            )}
          </div>
          <p className="font-mono text-[10px] text-text-dark">
            {t('proposals.votes', { yes: yesCount, no: noCount })}
          </p>
        </div>
      )}

      {/* Voters detail */}
      {total > 0 && (
        <div className="space-y-1.5 mb-2">
          {yesVoters.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-success font-semibold">{yesCount}</span>
              <AvatarStack size={20} members={yesVoters} />
              <span className="text-[10px] text-text-dark truncate">
                {yesVoters.map((v) => v.name).join(', ')}
              </span>
            </div>
          )}
          {noVoters.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-error font-semibold">{noCount}</span>
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
          <Button
            variant={myVote === 'yes' ? 'success' : 'secondary'}
            size="sm"
            onClick={() => onVote(proposal.id, 'yes')}
            disabled={isVoting}
            loading={isVoting}
            className="inline-flex items-center gap-1"
          >
            <HiOutlineCheck className="w-3.5 h-3.5" />
            {t('proposals.voteYes')}
          </Button>
          <Button
            variant={myVote === 'no' ? 'danger' : 'secondary'}
            size="sm"
            onClick={() => onVote(proposal.id, 'no')}
            disabled={isVoting}
            loading={isVoting}
            className="inline-flex items-center gap-1"
          >
            <HiOutlineXMark className="w-3.5 h-3.5" />
            {t('proposals.voteNo')}
          </Button>

          {/* Creator actions */}
          {isCreator && (
            <div className="flex items-center gap-1.5 ml-auto">
              <Button variant="primary" size="sm" onClick={() => onConvert?.(proposal)}>
                {t('proposals.convert')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onClose?.(proposal.id)}
                disabled={isClosing}
                loading={isClosing}
              >
                {t('proposals.close')}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
