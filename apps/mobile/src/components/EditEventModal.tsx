import { useState, useEffect } from 'react';
import { IonModal } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useUpdateEvent } from '../hooks/useEvents';
import { Button } from '../ui/Button';
import type { Event } from '../services/events';

interface EditEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  event: Event | null;
}

export function EditEventModal({ isOpen, onClose, groupId, event }: EditEventModalProps) {
  const { t } = useTranslation();
  const updateEvent = useUpdateEvent(groupId);

  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [time, setTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [description, setDescription] = useState('');
  const [isOnline, setIsOnline] = useState(false);
  const [meetingUrl, setMeetingUrl] = useState('');

  const isSaving = updateEvent.isPending;
  const endTimeError = !!(endTime && time && endTime <= time);
  const canSubmit = title.trim() && !isSaving && !endTimeError;

  useEffect(() => {
    if (isOpen && event) {
      setTitle(event.title);
      setLocation(event.location ?? '');
      setTime(event.time?.slice(0, 5) ?? '');
      setEndTime(event.endTime?.slice(0, 5) ?? '');
      setDescription(event.description ?? '');
      setIsOnline(event.isOnline ?? false);
      setMeetingUrl(event.meetingUrl ?? '');
    }
  }, [isOpen, event]);

  const handleSubmit = async () => {
    if (!canSubmit || !event) return;
    await updateEvent.mutateAsync({
      eventId: event.id,
      data: {
        title: title.trim(),
        ...(!isOnline && location.trim() ? { location: location.trim() } : { location: '' }),
        ...(time ? { time } : {}),
        ...(endTime ? { endTime } : {}),
        ...(description.trim() ? { description: description.trim() } : { description: '' }),
        isOnline,
        ...(isOnline && meetingUrl.trim() ? { meetingUrl: meetingUrl.trim() } : {}),
      },
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
      className="edit-event-modal"
    >
      <div className="px-5 pt-5 pb-9 bg-bg-light">
        {/* Handle bar */}
        <div className="w-8 h-[3px] rounded-sm bg-toggle-off mx-auto mb-3.5" />

        <h3 className="text-[17px] font-bold text-text mb-3.5">{t('plans.edit.title')}</h3>

        {/* Title */}
        <div className="mb-2">
          <label className="block text-[10px] text-text-dark mb-1">{t('plans.create.name')}</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('plans.create.namePlaceholder')}
            className="w-full rounded-[10px] px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-dark"
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

        {/* Time */}
        <div className="mb-2">
          <label className="block text-[10px] text-text-dark mb-1">{t('plans.create.time')}</label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full rounded-[10px] px-3 py-2.5 text-sm text-text outline-none"
            style={inputStyle}
          />
        </div>

        {/* End Time */}
        <div className="mb-2">
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

        {/* Description */}
        <div className="mb-4">
          <label className="block text-[10px] text-text-dark mb-1">
            {t('plans.create.description')}
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full rounded-[10px] px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-dark resize-none"
            style={inputStyle}
          />
        </div>

        {/* Submit */}
        <Button onClick={handleSubmit} disabled={!canSubmit} className="w-full">
          {isSaving ? t('plans.edit.saving') : t('plans.edit.submit')}
        </Button>
      </div>
    </IonModal>
  );
}
