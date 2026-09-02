import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useUpdateProposal } from '../hooks/useProposals';
import { Button } from '../ui/Button';
import { Sheet } from '../ui/Sheet';
import type { Proposal, UpdateProposalDto } from '../services/proposals';
import { useToast } from '../hooks/useToast';
import { runWithErrorToast } from '../lib/mutation-utils';

interface EditProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  proposal: Proposal | null;
}

export function EditProposalModal({ isOpen, onClose, groupId, proposal }: EditProposalModalProps) {
  const { t } = useTranslation();
  const updateProposal = useUpdateProposal(groupId);
  const { showError } = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [proposedDate, setProposedDate] = useState('');
  const [isOnline, setIsOnline] = useState(false);
  const [meetingUrl, setMeetingUrl] = useState('');

  const isSaving = updateProposal.isPending;
  const canSubmit = title.trim() && !isSaving;

  useEffect(() => {
    if (isOpen && proposal) {
      setTitle(proposal.title);
      setDescription(proposal.description ?? '');
      setLocation(proposal.location ?? '');
      setProposedDate(proposal.proposedDate ?? '');
      setIsOnline(proposal.isOnline ?? false);
      setMeetingUrl(proposal.meetingUrl ?? '');
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

    const originalIsOnline = proposal.isOnline ?? false;
    if (isOnline !== originalIsOnline) {
      changes.isOnline = isOnline;
    }

    const originalMeetingUrl = proposal.meetingUrl ?? '';
    const trimmedMeetingUrl = meetingUrl.trim();
    if (trimmedMeetingUrl !== originalMeetingUrl) {
      changes.meetingUrl = trimmedMeetingUrl;
    }

    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }

    await runWithErrorToast(
      () =>
        updateProposal.mutateAsync({
          proposalId: proposal.id,
          data: changes,
        }),
      showError,
      { onSuccess: onClose, errorKey: 'errors.updateProposalFailed' },
    );
  };

  const handleDismiss = () => {
    onClose();
  };

  const inputStyle = {
    background: 'var(--app-bg-hover)',
    border: '1px solid var(--app-border-strong)',
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={handleDismiss}
      title={t('proposals.edit')}
      footer={
        <Button onClick={handleSubmit} disabled={!canSubmit} className="w-full">
          {isSaving ? t('proposals.editSaving') : t('proposals.edit')}
        </Button>
      }
    >
        {/* Title */}
        <div className="mb-2">
          <label className="block text-[10px] text-text-dark mb-1">{t('plans.create.name')}</label>
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

        {/* Online toggle */}
        <div className="mb-2">
          <div
            className="flex items-center justify-between rounded-[10px] px-3 py-2.5"
            style={inputStyle}
          >
            <span className="text-sm text-text">{t('online.toggle')}</span>
            <button
              type="button"
              onClick={() => setIsOnline(!isOnline)}
              className={`relative w-10 h-5 rounded-full transition-colors ${isOnline ? 'bg-primary-tint' : 'bg-toggle-off'}`}
            >
              <div
                className={`absolute top-0.5 w-4 h-4 rounded-full transition-transform ${isOnline ? 'left-5 bg-primary' : 'left-0.5 bg-text-dark'}`}
              />
            </button>
          </div>
        </div>

        {/* Location or Meeting URL */}
        {isOnline ? (
          <div className="mb-2">
            <label className="block text-[10px] text-text-dark mb-1">
              {t('online.meetingUrl')}
            </label>
            <input
              type="url"
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
              placeholder={t('online.meetingUrlPlaceholder')}
              className="w-full rounded-[10px] px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-dark"
              style={inputStyle}
            />
          </div>
        ) : (
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
        )}

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

    </Sheet>
  );
}
