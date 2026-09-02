import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDateKey, capitalizeFirst } from '../lib/date-utils';
import { useCreateAvailability, useDeleteAvailability } from '../hooks/useAvailability';
import { useAuthStore } from '../stores/auth';
import { DEFAULT_TIME_SLOTS, getSlotHours } from '../lib/time-slot-utils';
import type { Availability, AvailabilityType, TimeSlot } from '../services/availability';
import { Button } from '../ui/Button';
import { Sheet } from '../ui/Sheet';
import { useToast } from '../hooks/useToast';
import { runWithErrorToast } from '../lib/mutation-utils';

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
  const userTimeSlots = useAuthStore((s) => s.user?.timeSlots) ?? DEFAULT_TIME_SLOTS;
  const createAvailability = useCreateAvailability(groupId);
  const deleteAvailability = useDeleteAvailability(groupId);
  const { showError } = useToast();

  const [type, setType] = useState<AvailabilityType>('day');
  const [selectedSlots, setSelectedSlots] = useState<TimeSlot[]>([]);
  const [fromTime, setFromTime] = useState('16:00');
  const [toTime, setToTime] = useState('22:00');

  // Seed the form when the sheet opens or when it points at a different row. A refetch that
  // hands us a new object for the same row (realtime sync) must not wipe an edit in progress.
  const latestExisting = useRef(existingAvailability);
  latestExisting.current = existingAvailability;
  const existingId = existingAvailability?.id;
  useEffect(() => {
    if (!isOpen) return;
    const existing = latestExisting.current;
    if (existing) {
      setType(existing.type);
      setSelectedSlots(existing.slots ?? []);
      if (existing.startTime) {
        setFromTime(existing.startTime.slice(0, 5));
      }
      if (existing.endTime) {
        setToTime(existing.endTime.slice(0, 5));
      }
    } else {
      setType('day');
      setSelectedSlots([]);
      setFromTime('16:00');
      setToTime('22:00');
    }
  }, [isOpen, existingId]);

  const toggleSlot = (slot: TimeSlot) => {
    setSelectedSlots((prev) =>
      prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot],
    );
  };

  const handleSave = async () => {
    if (!selectedDay) return;
    if (type === 'slots' && selectedSlots.length === 0) return;
    if (type === 'range' && fromTime >= toTime) return;

    const date = formatDateKey(selectedDay);
    await runWithErrorToast(
      () =>
        createAvailability.mutateAsync({
          date,
          type,
          ...(type === 'slots' && { slots: selectedSlots }),
          ...(type === 'range' && { startTime: fromTime, endTime: toTime }),
        }),
      showError,
      { onSuccess: onClose, errorKey: 'errors.saveAvailabilityFailed' },
    );
  };

  const handleDelete = async () => {
    if (!selectedDay) return;
    await runWithErrorToast(
      () => deleteAvailability.mutateAsync(formatDateKey(selectedDay)),
      showError,
      { onSuccess: onClose, errorKey: 'errors.deleteAvailabilityFailed' },
    );
  };

  const dateLabel = selectedDay?.toLocaleDateString(i18n.language === 'es' ? 'es-ES' : 'en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const isSaving = createAvailability.isPending;
  const isDeleting = deleteAvailability.isPending;

  const typeOptions: { key: AvailabilityType; label: string }[] = [
    { key: 'day', label: t('calendar.availability.typeDay') },
    { key: 'slots', label: t('calendar.availability.typeSlots') },
    { key: 'range', label: t('calendar.availability.typeRange') },
  ];

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={t('calendar.availability.title')}
      subtitle={capitalizeFirst(dateLabel)}
      footer={
        <>
          <Button
            onClick={handleSave}
            disabled={isSaving || (type === 'slots' && selectedSlots.length === 0)}
            className="w-full"
          >
            {isSaving ? t('calendar.availability.saving') : t('calendar.availability.save')}
          </Button>

          {existingAvailability && (
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="w-full mt-1.5 py-2.5 rounded-btn text-xs font-semibold transition-colors"
              style={{
                background: 'var(--app-bg-hover)',
                color: '#FB7185',
                border: '1px solid rgba(251,113,133,0.15)',
              }}
            >
              {isDeleting ? t('calendar.availability.deleting') : t('calendar.availability.delete')}
            </button>
          )}
        </>
      }
    >
        {/* Type selector */}
        <div className="flex gap-1 mb-3.5">
          {typeOptions.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setType(key)}
              className="flex-1 py-2 rounded-[9px] text-xs font-semibold transition-colors"
              style={{
                background:
                  type === key
                    ? 'color-mix(in srgb, var(--app-primary) 12%, transparent)'
                    : 'var(--app-bg-card)',
                color: type === key ? 'var(--app-text)' : 'var(--app-text-dark)',
                border: `1px solid ${type === key ? 'color-mix(in srgb, var(--app-primary) 20%, transparent)' : 'var(--app-border)'}`,
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
                    ? 'color-mix(in srgb, var(--app-primary) 12%, transparent)'
                    : 'var(--app-bg-card)',
                  color: selectedSlots.includes(slot) ? 'var(--app-text)' : 'var(--app-text-dark)',
                  border: `1px solid ${selectedSlots.includes(slot) ? 'color-mix(in srgb, var(--app-primary) 20%, transparent)' : 'var(--app-border)'}`,
                }}
              >
                {t(`calendar.availability.${SLOT_KEYS[idx]}`)}
                <div className="text-[9px] text-text-dark mt-0.5">
                  {getSlotHours(SLOT_KEYS[idx], userTimeSlots)}
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
                onChange={(e) => {
                  const newFrom = e.target.value;
                  setFromTime(newFrom);
                  if (toTime <= newFrom) {
                    const idx = Math.floor(
                      parseInt(newFrom.split(':')[0]) * 2 +
                        (newFrom.split(':')[1] === '30' ? 1 : 0) +
                        1,
                    );
                    const h = String(Math.floor(idx / 2)).padStart(2, '0');
                    const m = idx % 2 === 0 ? '00' : '30';
                    setToTime(idx < 48 ? `${h}:${m}` : '23:59');
                  }
                }}
                className="w-full rounded-[10px] p-2 text-sm text-text"
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
                className="w-full rounded-[10px] p-2 text-sm text-text"
                style={{
                  background: 'var(--app-bg-hover)',
                  border: '1px solid var(--app-border-strong)',
                }}
              >
                {Array.from({ length: 48 }, (_, i) => {
                  const h = String(Math.floor(i / 2)).padStart(2, '0');
                  const m = i % 2 === 0 ? '00' : '30';
                  const val = `${h}:${m}`;
                  if (val <= fromTime) return null;
                  return (
                    <option key={i} value={val}>
                      {h}:{m}
                    </option>
                  );
                })}
                <option value="23:59">23:59</option>
              </select>
            </div>
          </div>
        )}

    </Sheet>
  );
}
