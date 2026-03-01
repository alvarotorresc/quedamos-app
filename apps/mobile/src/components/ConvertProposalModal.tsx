import { useState, useEffect } from 'react';
import { IonModal } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useConvertProposal } from '../hooks/useProposals';
import { Button } from '../ui/Button';
import type { Proposal } from '../services/proposals';

interface ConvertProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  proposal: Proposal | null;
}

export function ConvertProposalModal({ isOpen, onClose, groupId, proposal }: ConvertProposalModalProps) {
  const { t } = useTranslation();
  const convertProposal = useConvertProposal(groupId);

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
    await convertProposal.mutateAsync({
      proposalId: proposal.id,
      data: {
        date,
        ...(time && { time }),
        ...(endTime && { endTime }),
      },
    });
    onClose();
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

  const today = new Date().toISOString().split('T')[0];

  return (
    <IonModal
      isOpen={isOpen}
      onDidDismiss={handleDismiss}
      breakpoints={[0, 1]}
      initialBreakpoint={1}
      className="convert-proposal-modal"
    >
      <div className="px-5 pt-5 pb-9 bg-bg-light">
        {/* Handle bar */}
        <div className="w-8 h-[3px] rounded-sm bg-toggle-off mx-auto mb-3.5" />

        <h3 className="text-[17px] font-bold text-text mb-0.5">
          {t('proposals.convert')}
        </h3>
        {proposal && (
          <p className="text-xs text-text-dark mb-3.5">
            {proposal.title}
          </p>
        )}

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
            className="w-full rounded-[10px] px-3 py-2.5 text-sm text-text outline-none"
            style={inputStyle}
          />
        </div>

        {/* Time */}
        <div className="mb-2">
          <label className="block text-[10px] text-text-dark mb-1">
            {t('plans.create.time')}
          </label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full rounded-[10px] px-3 py-2.5 text-sm text-text outline-none"
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
            className="w-full rounded-[10px] px-3 py-2.5 text-sm text-text outline-none"
            style={inputStyle}
          />
          {endTimeError && (
            <p className="text-[10px] text-danger mt-1">{t('plans.create.endTimeError')}</p>
          )}
        </div>

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full"
        >
          {isConverting ? t('proposals.converting') : t('proposals.convert')}
        </Button>
      </div>
    </IonModal>
  );
}
