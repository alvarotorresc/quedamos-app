import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { HiOutlineVideoCamera } from 'react-icons/hi2';
import { useConvertProposal } from '../hooks/useProposals';
import { Button } from '../ui/Button';
import { Sheet } from '../ui/Sheet';
import type { Proposal } from '../services/proposals';
import { useToast } from '../hooks/useToast';
import { runWithErrorToast } from '../lib/mutation-utils';
import { formatDateKey } from '../lib/date-utils';

interface ConvertProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  proposal: Proposal | null;
}

export function ConvertProposalModal({
  isOpen,
  onClose,
  groupId,
  proposal,
}: ConvertProposalModalProps) {
  const { t } = useTranslation();
  const convertProposal = useConvertProposal(groupId);
  const { showError } = useToast();

  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [endTime, setEndTime] = useState('');

  const isConverting = convertProposal.isPending;
  const endTimeError = !!(endTime && time && endTime <= time);
  const canSubmit = date && !isConverting && !endTimeError;

  useEffect(() => {
    if (isOpen) {
      setDate(proposal?.proposedDate ?? '');
      setTime('');
      setEndTime('');
    }
  }, [isOpen, proposal?.proposedDate]);

  const handleSubmit = async () => {
    if (!canSubmit || !proposal) return;
    await runWithErrorToast(
      () =>
        convertProposal.mutateAsync({
          proposalId: proposal.id,
          data: { date, ...(time && { time }), ...(endTime && { endTime }) },
        }),
      showError,
      { onSuccess: onClose, errorKey: 'errors.convertProposalFailed' },
    );
  };

  const handleDismiss = () => {
    setDate('');
    setTime('');
    setEndTime('');
    onClose();
  };

  const inputStyle = {
    background: 'var(--app-bg-hover)',
    border: '1px solid var(--app-border-strong)',
  };

  const today = formatDateKey(new Date());

  return (
    <Sheet
      isOpen={isOpen}
      onClose={handleDismiss}
      title={t('proposals.convert')}
      subtitle={proposal?.title}
      footer={
        <Button onClick={handleSubmit} disabled={!canSubmit} className="w-full">
          {isConverting ? t('proposals.converting') : t('proposals.convert')}
        </Button>
      }
    >
        {proposal?.isOnline && (
          <div className="flex items-center gap-1.5 text-xs text-primary mb-2">
            <HiOutlineVideoCamera className="w-3.5 h-3.5" />
            <span>{t('online.badge')}</span>
          </div>
        )}
        {!proposal?.isOnline && <div className="mb-2" />}

        {/* Date */}
        <div className="mb-2">
          <label className="block text-[10px] text-text-dark mb-1">
            {t('proposals.convertDate')}
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            min={today}
            className="w-full rounded-[10px] px-3 py-2.5 text-sm text-text"
            style={inputStyle}
          />
        </div>

        {/* Time */}
        <div className="mb-2">
          <label className="block text-[10px] text-text-dark mb-1">{t('plans.create.time')}</label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full rounded-[10px] px-3 py-2.5 text-sm text-text"
            style={inputStyle}
          />
        </div>

        {/* End Time */}
        <div className="mb-4">
          <label className="block text-[10px] text-text-dark mb-1">
            {t('plans.create.endTime')}
          </label>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            min={time || undefined}
            className="w-full rounded-[10px] px-3 py-2.5 text-sm text-text"
            style={inputStyle}
          />
          {endTimeError && (
            <p className="text-[10px] text-danger mt-1">{t('plans.create.endTimeError')}</p>
          )}
        </div>

    </Sheet>
  );
}
