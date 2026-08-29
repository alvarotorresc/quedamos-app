import { useCallback, useEffect, useRef, useState } from 'react';
import { usePendingQuestions, usePolls } from '../hooks/usePolls';
import { useEvents } from '../hooks/useEvents';
import { Mazo } from './Mazo';

export interface MazoGateProps {
  groupId: string;
  focusPollId?: string | null;
  presetAnswer?: 'yes' | 'no' | null;
  /**
   * Called every time the mazo dismisses (button, done-dwell, or empty queue) — used by
   * CalendarPage to clear the deep-link URL params once the mazo is actually done with
   * them (Task 7). Must be referentially stable across renders (e.g. via `useCallback`
   * with an empty/stable dependency list): it flows into `handleDismiss` below, which
   * Mazo's own dwell-timer effect is keyed on, so a fresh identity on every render would
   * silently re-arm that timer.
   */
  onDismiss?: () => void;
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
export function MazoGate({
  groupId,
  focusPollId = null,
  presetAnswer = null,
  onDismiss,
}: MazoGateProps) {
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

  // A deep link for a poll the mazo hasn't already opened for must reopen it, even if the
  // user dismissed the mazo earlier this session — it only ever clears `dismissed`, never
  // touches `open` directly, so the closing invariant above (only onDismiss / a group
  // switch closes it) still holds.
  const seenFocusPollId = useRef<string | null>(null);
  useEffect(() => {
    if (focusPollId && focusPollId !== seenFocusPollId.current) {
      setDismissed(false);
    }
    seenFocusPollId.current = focusPollId;
  }, [focusPollId]);

  useEffect(() => {
    if (open || dismissed) return;
    if (!groupId || pollsLoading || eventsLoading) return;
    if (polls.length === 0 && pendingEvents.length === 0) return;
    setOpen(true);
  }, [open, dismissed, groupId, pollsLoading, eventsLoading, polls, pendingEvents]);

  // Cleanup must not depend on the mazo ever opening (IMPORTANT 2, fix round 1): it never
  // opens for a focused poll that answered elsewhere, whose date already passed
  // (usePendingQuestions filters those out), or that was closed/deleted between the push
  // and the tap — all normal occurrences, not just an exotic edge case. Once the queries
  // have resolved, if the focused poll isn't among the pending ones, the mazo can never
  // consume it — clear the deep link directly via the `onDismiss` prop (not
  // `handleDismiss`: there's no open mazo here to mark `dismissed` for). Guarded by
  // `orphanClearedFor` so it fires at most once per distinct `focusPollId` — including the
  // ordinary case where the poll WAS pending and the mazo answered it normally, which
  // would otherwise also match here right as the query invalidates; that's a harmless
  // second call into the same idempotent `clear()` already fired by `handleDismiss` below.
  const orphanClearedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!focusPollId) return;
    if (pollsLoading || eventsLoading) return;
    if (orphanClearedFor.current === focusPollId) return;
    if (polls.some((p) => p.id === focusPollId)) return;
    orphanClearedFor.current = focusPollId;
    onDismiss?.();
  }, [focusPollId, pollsLoading, eventsLoading, polls, onDismiss]);

  // Stable across re-renders so Mazo's own dwell-timer effect (keyed on `onDismiss`)
  // never sees a fresh identity and cancels/rearms itself mid-dwell.
  const handleDismiss = useCallback(() => {
    setOpen(false);
    setDismissed(true);
    onDismiss?.();
  }, [onDismiss]);

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
