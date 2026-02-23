import { useState, useEffect } from 'react';
import { IonModal } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useCreateEvent } from '../hooks/useEvents';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';

export interface EventPrefill {
  date: string;
  dateLabel: string;
  suggestedTime: string | null;
  suggestedSlot: string | null;
  availableMembers: { name: string; color: string }[];
  availableCount: number;
}

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  prefill: EventPrefill | null;
}

export function CreateEventModal({ isOpen, onClose, groupId, prefill }: CreateEventModalProps) {
  const { t } = useTranslation();
  const createEvent = useCreateEvent(groupId);

  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [time, setTime] = useState('');

  const isCreating = createEvent.isPending;
  const canSubmit = title.trim() && prefill?.date && !isCreating;

  useEffect(() => {
    if (isOpen && prefill) {
      setTitle('');
      setLocation('');
      setTime(prefill.suggestedTime ?? '');
    }
  }, [isOpen, prefill]);

  const handleSubmit = async () => {
    if (!canSubmit || !prefill) return;
    await createEvent.mutateAsync({
      title: title.trim(),
      date: prefill.date,
      ...(time && { time }),
      ...(location.trim() && { location: location.trim() }),
    });
    setTitle('');
    setLocation('');
    setTime('');
    onClose();
  };

  const handleDismiss = () => {
    setTitle('');
    setLocation('');
    setTime('');
    onClose();
  };

  const inputStyle = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.07)',
  };

  return (
    <IonModal
      isOpen={isOpen}
      onDidDismiss={handleDismiss}
      breakpoints={[0, 1]}
      initialBreakpoint={1}
      className="create-event-modal"
    >
      <div className="px-5 pt-5 pb-9 bg-bg-light">
        {/* Handle bar */}
        <div className="w-8 h-[3px] rounded-sm bg-white/10 mx-auto mb-3.5" />

        <h3 className="text-[17px] font-bold text-text mb-0.5">
          {t('plans.create.title')}
        </h3>
        <p className="text-xs text-text-dark mb-3.5 capitalize">
          {prefill?.dateLabel} · {prefill?.availableCount} {t('plans.create.available')}
        </p>

        {/* Title */}
        <div className="mb-2">
          <label className="block text-[10px] text-text-dark mb-1">
            {t('plans.create.name')}
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('plans.create.namePlaceholder')}
            className="w-full rounded-[10px] px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-dark"
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

        {/* Time */}
        <div className="mb-3">
          <label className="block text-[10px] text-text-dark mb-1">
            {t('plans.create.time')}
            {prefill?.suggestedTime && prefill?.suggestedSlot && (
              <span className="ml-1.5 text-primary">
                · {t('plans.create.suggested')}: {t(`calendar.availability.${prefill.suggestedSlot}`)}
              </span>
            )}
          </label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full rounded-[10px] px-3 py-2.5 text-sm text-text outline-none"
            style={inputStyle}
          />
        </div>

        {/* Attendees */}
        {prefill && prefill.availableMembers.length > 0 && (
          <div className="mb-4">
            <label className="block text-[10px] text-text-dark mb-1.5">
              {t('plans.create.attendees')}
            </label>
            <div className="flex gap-1 flex-wrap">
              {prefill.availableMembers.map((m, i) => (
                <div
                  key={`${m.name}-${i}`}
                  className="flex items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-2.5"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <Avatar name={m.name} color={m.color} size={20} />
                  <span className="text-[11px] text-text-muted">{m.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full"
        >
          {isCreating ? t('plans.create.creating') : t('plans.create.submit')}
        </Button>
      </div>
    </IonModal>
  );
}
