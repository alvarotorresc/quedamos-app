import { useState, useEffect } from 'react';
import { IonModal } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useUpdateProposal } from '../hooks/useProposals';
import { Button } from '../ui/Button';
import type { Proposal, UpdateProposalDto } from '../services/proposals';

interface EditProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  proposal: Proposal | null;
}

export function EditProposalModal({ isOpen, onClose, groupId, proposal }: EditProposalModalProps) {
  const { t } = useTranslation();
  const updateProposal = useUpdateProposal(groupId);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [proposedDate, setProposedDate] = useState('');

  const isSaving = updateProposal.isPending;
  const canSubmit = title.trim() && !isSaving;

  useEffect(() => {
    if (isOpen && proposal) {
      setTitle(proposal.title);
      setDescription(proposal.description ?? '');
      setLocation(proposal.location ?? '');
      setProposedDate(proposal.proposedDate ?? '');
    }
  }, [isOpen, proposal]);

  const handleSubmit = async () => {
    if (!canSubmit || !proposal) return;

    const changes: UpdateProposalDto = {};

    const trimmedTitle = title.trim();
    if (trimmedTitle !== proposal.title) {
      changes.title = trimmedTitle;
    }

    const trimmedDescription = description.trim();
    const originalDescription = proposal.description ?? '';
    if (trimmedDescription !== originalDescription) {
      changes.description = trimmedDescription;
    }

    const trimmedLocation = location.trim();
    const originalLocation = proposal.location ?? '';
    if (trimmedLocation !== originalLocation) {
      changes.location = trimmedLocation;
    }

    const originalDate = proposal.proposedDate ?? '';
    if (proposedDate !== originalDate) {
      changes.proposedDate = proposedDate;
    }

    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }

    await updateProposal.mutateAsync({
      proposalId: proposal.id,
      data: changes,
    });
    onClose();
  };

  const handleDismiss = () => {
    onClose();
  };

  const inputStyle = {
    background: 'var(--app-bg-hover)',
    border: '1px solid var(--app-border-strong)',
  };

  return (
    <IonModal
      isOpen={isOpen}
      onDidDismiss={handleDismiss}
      breakpoints={[0, 1]}
      initialBreakpoint={1}
      className="edit-proposal-modal"
    >
      <div className="px-5 pt-5 pb-9 bg-bg-light">
        {/* Handle bar */}
        <div className="w-8 h-[3px] rounded-sm bg-toggle-off mx-auto mb-3.5" />

        <h3 className="text-[17px] font-bold text-text mb-3.5">
          {t('proposals.edit')}
        </h3>

        {/* Title */}
        <div className="mb-2">
          <label className="block text-[10px] text-text-dark mb-1">
            {t('plans.create.name')}
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('proposals.titlePlaceholder')}
            className="w-full rounded-[10px] px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-dark"
            style={inputStyle}
          />
        </div>

        {/* Description */}
        <div className="mb-2">
          <label className="block text-[10px] text-text-dark mb-1">
            {t('proposals.description')}
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('proposals.descriptionPlaceholder')}
            rows={3}
            className="w-full rounded-[10px] px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-dark resize-none"
            style={inputStyle}
          />
        </div>

        {/* Location */}
        <div className="mb-2">
          <label className="block text-[10px] text-text-dark mb-1">
            {t('plans.create.location')}
          </label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder={t('plans.create.locationPlaceholder')}
            className="w-full rounded-[10px] px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-dark"
            style={inputStyle}
          />
        </div>

        {/* Proposed Date */}
        <div className="mb-4">
          <label className="block text-[10px] text-text-dark mb-1">
            {t('proposals.proposedDate')}
          </label>
          <input
            type="date"
            value={proposedDate}
            onChange={(e) => setProposedDate(e.target.value)}
            className="w-full rounded-[10px] px-3 py-2.5 text-sm text-text outline-none"
            style={inputStyle}
          />
        </div>

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full"
        >
          {isSaving ? t('proposals.editSaving') : t('proposals.edit')}
        </Button>
      </div>
    </IonModal>
  );
}
