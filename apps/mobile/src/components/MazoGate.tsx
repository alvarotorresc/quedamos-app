import { useCallback, useEffect, useRef, useState } from 'react';
import { usePendingQuestions, usePolls } from '../hooks/usePolls';
import { useEvents } from '../hooks/useEvents';
import { useToast } from '../hooks/useToast';
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
 * A second latch, `evaluated`, guards the *opening* side the same way `dismissed` guards
 * closing (fix round 2, C1): once the pending-questions queries have resolved once for
 * this group, the mount-condition effect below stops reacting to further changes in the
 * live `polls`/`pendingEvents` data for the rest of the session. Without it, a group
 * member who opened the app with nothing pending (so the mazo never opened, `dismissed`
 * stays false all session) would get the mazo suddenly slammed open mid-task the moment
 * anyone in the group asked a question — the realtime `broadcastSync` invalidates and
 * refetches `polls`, growing it from empty to non-empty, and the old effect treated that
 * exactly like an initial mount. `evaluated` is reset by the same two things that
 * legitimately warrant a fresh look: a group switch, and a new `focusPollId` (a deep
 * link must still open the mazo for its poll even after the group was already evaluated
 * empty this session).
 *
 * A group switch resets both latches so the new group gets evaluated fresh.
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
  const { showInfo } = useToast();

  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [evaluated, setEvaluated] = useState(false);

  // Fresh evaluation per group — neither "already open", "already dismissed" nor
  // "already evaluated" should carry over from whatever group was previously selected.
  useEffect(() => {
    setOpen(false);
    setDismissed(false);
    setEvaluated(false);
  }, [groupId]);

  // A deep link for a poll the mazo hasn't already opened for must reopen it, even if the
  // user dismissed the mazo earlier this session, or the group was already evaluated
  // with nothing pending — it only ever clears `dismissed`/`evaluated`, never touches
  // `open` directly, so the closing invariant above (only onDismiss / a group switch
  // closes it) still holds.
  const seenFocusPollId = useRef<string | null>(null);
  useEffect(() => {
    if (focusPollId && focusPollId !== seenFocusPollId.current) {
      setDismissed(false);
      setEvaluated(false);
    }
    seenFocusPollId.current = focusPollId;
  }, [focusPollId]);

  useEffect(() => {
    if (evaluated) return;
    if (!groupId || pollsLoading || eventsLoading) return;
    // Both queries have resolved for this group — mark it evaluated regardless of the
    // outcome below, so a later live-data change (someone else asking a question) can't
    // reopen the mount-condition check for the rest of the session.
    setEvaluated(true);
    if (open || dismissed) return;
    if (polls.length === 0 && pendingEvents.length === 0) return;
    setOpen(true);
  }, [evaluated, open, dismissed, groupId, pollsLoading, eventsLoading, polls, pendingEvents]);

  // Tracks whether the currently-focused deep-link poll was ever actually seen among the
  // pending ones — lets the orphan-cleanup effect below tell "answered normally, now gone
  // from the live list because it was just consumed" apart from "never was pending to
  // begin with" (fix round 2, I4). A ref, not state: it only needs to be read by that
  // effect, declared right after this one so it observes the same-render write.
  const focusSeenPendingRef = useRef<string | null>(null);
  useEffect(() => {
    if (focusPollId && polls.some((p) => p.id === focusPollId)) {
      focusSeenPendingRef.current = focusPollId;
    }
  }, [focusPollId, polls]);

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
  //
  // A genuinely orphaned deep link (I4) — the user tapped "Puedo"/"No puedo" on a push
  // for a poll that's already answered elsewhere, closed, or deleted — silently drops the
  // answer with no feedback: the app clears the URL and lands on the calendar as if
  // nothing happened. `focusSeenPendingRef` tells that case apart from the harmless
  // normal-answer race above: only show the toast when this focusPollId was NEVER seen
  // pending, i.e. it could not have been consumed by an open mazo.
  const orphanClearedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!focusPollId) return;
    if (pollsLoading || eventsLoading) return;
    if (orphanClearedFor.current === focusPollId) return;
    if (polls.some((p) => p.id === focusPollId)) return;
    orphanClearedFor.current = focusPollId;
    if (focusSeenPendingRef.current !== focusPollId) {
      showInfo('mazo.notPendingAnymore');
    }
    onDismiss?.();
    // showInfo is a fresh object each render (useToast isn't memoized); orphanClearedFor
    // guards re-firing, same pattern as Mazo's presetAnswer effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
