import { useCallback, useEffect, useState } from 'react';
import { usePendingQuestions, usePolls } from '../hooks/usePolls';
import { useEvents } from '../hooks/useEvents';
import { Mazo } from './Mazo';

export interface MazoGateProps {
  groupId: string;
  focusPollId?: string | null;
  presetAnswer?: 'yes' | 'no' | null;
}

/**
 * Owns the mazo's open/closed latch, decoupled from the live pending-questions data.
 *
 * The mazo opens once, when pending questions are first detected for the current group,
 * and from then on only its own `onDismiss` — fired by "Al mapa", an emptied queue, or
 * the done-dwell timeout — closes it. It must NOT close just because the live counts
 * happen to drop to zero while it's open: answering the last question invalidates the
 * `polls`/`events` queries (react-query's own onSuccess plus the realtime
 * `broadcastSync` re-invalidation), and that refetch routinely resolves well inside the
 * 600ms "Ya está." dwell. Without this latch, re-evaluating the mount condition against
 * live data on every render would unmount `<Mazo>` mid-dwell — "Ya está." never shows,
 * and the dwell effect's `onDismiss()` never runs because its effect gets torn down
 * first. Task 7's deep-link flow depends on that `onDismiss` running (it clears the URL
 * params after consuming them), so this isn't just cosmetic.
 *
 * A group switch resets the latch so the new group gets evaluated fresh.
 */
export function MazoGate({ groupId, focusPollId = null, presetAnswer = null }: MazoGateProps) {
  const { isLoading: pollsLoading } = usePolls(groupId);
  const { isLoading: eventsLoading } = useEvents(groupId);
  const { polls, pendingEvents } = usePendingQuestions(groupId);

  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Fresh evaluation per group — neither "already open" nor "already dismissed" should
  // carry over from whatever group was previously selected.
  useEffect(() => {
    setOpen(false);
    setDismissed(false);
  }, [groupId]);

  useEffect(() => {
    if (open || dismissed) return;
    if (!groupId || pollsLoading || eventsLoading) return;
    if (polls.length === 0 && pendingEvents.length === 0) return;
    setOpen(true);
  }, [open, dismissed, groupId, pollsLoading, eventsLoading, polls, pendingEvents]);

  // Stable across re-renders so Mazo's own dwell-timer effect (keyed on `onDismiss`)
  // never sees a fresh identity and cancels/rearms itself mid-dwell.
  const handleDismiss = useCallback(() => {
    setOpen(false);
    setDismissed(true);
  }, []);

  if (!open) return null;

  return (
    <Mazo
      key={groupId}
      groupId={groupId}
      focusPollId={focusPollId}
      presetAnswer={presetAnswer}
      onDismiss={handleDismiss}
    />
  );
}

export default MazoGate;
