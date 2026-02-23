import { useState, useEffect } from 'react';
import { IonModal } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { formatDateKey } from '../lib/date-utils';
import { useCreateAvailability, useDeleteAvailability } from '../hooks/useAvailability';
import type { Availability, AvailabilityType, TimeSlot } from '../services/availability';
import { Button } from '../ui/Button';

interface AvailabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDay: Date | null;
  groupId: string;
  existingAvailability?: Availability | null;
}

const SLOTS: TimeSlot[] = ['Mañana', 'Tarde', 'Noche'];
const SLOT_KEYS = ['morning', 'afternoon', 'night'] as const;

export function AvailabilityModal({
  isOpen,
  onClose,
  selectedDay,
  groupId,
  existingAvailability,
}: AvailabilityModalProps) {
  const { t, i18n } = useTranslation();
  const createAvailability = useCreateAvailability(groupId);
  const deleteAvailability = useDeleteAvailability(groupId);

  const [type, setType] = useState<AvailabilityType>('day');
  const [selectedSlots, setSelectedSlots] = useState<TimeSlot[]>([]);
  const [fromTime, setFromTime] = useState('16:00');
  const [toTime, setToTime] = useState('22:00');

  useEffect(() => {
    if (existingAvailability) {
      setType(existingAvailability.type);
      setSelectedSlots(existingAvailability.slots ?? []);
      if (existingAvailability.startTime) {
        setFromTime(existingAvailability.startTime.slice(0, 5));
      }
      if (existingAvailability.endTime) {
        setToTime(existingAvailability.endTime.slice(0, 5));
      }
    } else {
      setType('day');
      setSelectedSlots([]);
      setFromTime('16:00');
      setToTime('22:00');
    }
  }, [existingAvailability, isOpen]);

  const toggleSlot = (slot: TimeSlot) => {
    setSelectedSlots((prev) =>
      prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot]
    );
  };

  const handleSave = async () => {
    if (!selectedDay) return;
    if (type === 'slots' && selectedSlots.length === 0) return;
    if (type === 'range' && fromTime >= toTime) return;

    const date = formatDateKey(selectedDay);
    await createAvailability.mutateAsync({
      date,
      type,
      ...(type === 'slots' && { slots: selectedSlots }),
      ...(type === 'range' && {
        startTime: fromTime,
        endTime: toTime,
      }),
    });
    onClose();
  };

  const handleDelete = async () => {
    if (!selectedDay) return;
    await deleteAvailability.mutateAsync(formatDateKey(selectedDay));
    onClose();
  };

  const dateLabel = selectedDay?.toLocaleDateString(
    i18n.language === 'es' ? 'es-ES' : 'en-US',
    { weekday: 'long', day: 'numeric', month: 'long' }
  );

  const isSaving = createAvailability.isPending;
  const isDeleting = deleteAvailability.isPending;

  const typeOptions: { key: AvailabilityType; label: string }[] = [
    { key: 'day', label: t('calendar.availability.typeDay') },
    { key: 'slots', label: t('calendar.availability.typeSlots') },
    { key: 'range', label: t('calendar.availability.typeRange') },
  ];

  return (
    <IonModal
      isOpen={isOpen}
      onDidDismiss={onClose}
      breakpoints={[0, 1]}
      initialBreakpoint={1}
      className="availability-modal"
    >
      <div className="px-5 pt-5 pb-9 bg-bg-light">
        {/* Handle bar */}
        <div className="w-8 h-[3px] rounded-sm bg-toggle-off mx-auto mb-3.5" />

        <h3 className="text-[17px] font-bold text-text mb-0.5">
          {t('calendar.availability.title')}
        </h3>
        <p className="text-xs text-text-dark mb-3.5 capitalize">{dateLabel}</p>

        {/* Type selector */}
        <div className="flex gap-1 mb-3.5">
          {typeOptions.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setType(key)}
              className="flex-1 py-2 rounded-[9px] text-xs font-semibold transition-colors"
              style={{
                background: type === key ? 'rgba(37,99,235,0.12)' : 'var(--app-bg-card)',
                color: type === key ? '#60A5FA' : '#4B5C75',
                border: `1px solid ${type === key ? 'rgba(96,165,250,0.2)' : 'var(--app-border)'}`,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Slots */}
        {type === 'slots' && (
          <div className="flex gap-1.5 mb-3.5">
            {SLOTS.map((slot, idx) => (
              <button
                key={slot}
                onClick={() => toggleSlot(slot)}
                className="flex-1 py-2.5 rounded-[9px] text-xs font-semibold transition-colors"
                style={{
                  background: selectedSlots.includes(slot)
                    ? 'rgba(37,99,235,0.12)'
                    : 'var(--app-bg-card)',
                  color: selectedSlots.includes(slot) ? '#60A5FA' : '#4B5C75',
                  border: `1px solid ${selectedSlots.includes(slot) ? 'rgba(96,165,250,0.2)' : 'var(--app-border)'}`,
                }}
              >
                {t(`calendar.availability.${SLOT_KEYS[idx]}`)}
                <div className="text-[9px] text-text-dark mt-0.5">
                  {t(`calendar.availability.${SLOT_KEYS[idx]}Hours`)}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Range */}
        {type === 'range' && (
          <div className="flex gap-2.5 items-center mb-3.5">
            <div className="flex-1">
              <label className="block text-[10px] text-text-dark mb-1">
                {t('calendar.availability.from')}
              </label>
              <select
                value={fromTime}
                onChange={(e) => setFromTime(e.target.value)}
                className="w-full rounded-[10px] p-2 text-sm text-text outline-none"
                style={{
                  background: 'var(--app-bg-hover)',
                  border: '1px solid var(--app-border-strong)',
                }}
              >
                {Array.from({ length: 48 }, (_, i) => {
                  const h = String(Math.floor(i / 2)).padStart(2, '0');
                  const m = i % 2 === 0 ? '00' : '30';
                  return (
                    <option key={i} value={`${h}:${m}`}>
                      {h}:{m}
                    </option>
                  );
                })}
              </select>
            </div>
            <span className="text-text-dark mt-3.5">→</span>
            <div className="flex-1">
              <label className="block text-[10px] text-text-dark mb-1">
                {t('calendar.availability.to')}
              </label>
              <select
                value={toTime}
                onChange={(e) => setToTime(e.target.value)}
                className="w-full rounded-[10px] p-2 text-sm text-text outline-none"
                style={{
                  background: 'var(--app-bg-hover)',
                  border: '1px solid var(--app-border-strong)',
                }}
              >
                {Array.from({ length: 48 }, (_, i) => {
                  const h = String(Math.floor(i / 2)).padStart(2, '0');
                  const m = i % 2 === 0 ? '00' : '30';
                  return (
                    <option key={i} value={`${h}:${m}`}>
                      {h}:{m}
                    </option>
                  );
                })}
                <option value="23:59">23:59</option>
              </select>
            </div>
          </div>
        )}

        {/* Save button */}
        <Button
          onClick={handleSave}
          disabled={isSaving || (type === 'slots' && selectedSlots.length === 0)}
          className="w-full mb-1.5"
        >
          {isSaving
            ? t('calendar.availability.saving')
            : t('calendar.availability.save')}
        </Button>

        {/* Delete button */}
        {existingAvailability && (
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="w-full py-2.5 rounded-btn text-xs font-semibold transition-colors"
            style={{
              background: 'var(--app-bg-hover)',
              color: '#FB7185',
              border: '1px solid rgba(251,113,133,0.15)',
            }}
          >
            {isDeleting
              ? t('calendar.availability.deleting')
              : t('calendar.availability.delete')}
          </button>
        )}
      </div>
    </IonModal>
  );
}
