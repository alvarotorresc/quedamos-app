import { useEffect, useState } from 'react';
import { IonModal } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { SegmentedPills } from '../ui/SegmentedPills';
import { Button } from '../ui/Button';
import { useCreatePoll } from '../hooks/usePolls';
import { useToast } from '../hooks/useToast';
import { formatDateKey } from '../lib/date-utils';
import { SLOT_KEYS } from '../lib/availability-label';
import { ApiError } from '../lib/api';
import type { TimeSlot } from '../services/availability';

interface AskGroupSheetProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  day: Date | null;
}

/** 'full' stands for "whole day" — SegmentedPills needs a string value, so the API's
 * omitted-slot day-complete poll gets this sentinel instead of `null`. */
type SlotChoice = 'full' | TimeSlot;

const SLOTS: TimeSlot[] = ['Mañana', 'Tarde', 'Noche'];

export function AskGroupSheet({ isOpen, onClose, groupId, day }: AskGroupSheetProps) {
  const { t, i18n } = useTranslation();
  const createPoll = useCreatePoll(groupId);
  const { showError, showInfo } = useToast();

  const [slot, setSlot] = useState<SlotChoice>('full');

  // Reset the franja pick every time the sheet is (re)opened for a day.
  useEffect(() => {
    if (isOpen) setSlot('full');
  }, [isOpen, day]);

  const dateLabel = day?.toLocaleDateString(i18n.language === 'es' ? 'es-ES' : 'en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const isAsking = createPoll.isPending;

  const handleAsk = async () => {
    if (!day) return;
    const date = formatDateKey(day);
    try {
      const result = await createPoll.mutateAsync(slot === 'full' ? { date } : { date, slot });
      // Anti-spam silenced the push (I3) — the poll still exists, but the asker would
      // otherwise believe the group got notified when it didn't.
      if (!result.notified) showInfo('calendar.askNotNotified');
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        showError('calendar.askDuplicate');
      } else {
        showError('errors.generic');
      }
    }
  };

  const options: { value: SlotChoice; label: string }[] = [
    { value: 'full', label: t('calendar.allDay') },
    ...SLOTS.map((s): { value: SlotChoice; label: string } => ({ value: s, label: t(SLOT_KEYS[s]) })),
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

        <h3 className="text-[17px] font-bold text-text mb-0.5">{t('calendar.askTitle')}</h3>
        <p className="text-xs text-text-dark mb-3.5 capitalize">{dateLabel}</p>

        <SegmentedPills options={options} value={slot} onChange={setSlot} className="mb-3.5" />

        <p className="text-xs text-text-muted mb-4">{t('calendar.askHint')}</p>

        <Button variant="primary" onClick={handleAsk} disabled={isAsking} className="w-full">
          {t('calendar.askAction')}
        </Button>
      </div>
    </IonModal>
  );
}

export default AskGroupSheet;
