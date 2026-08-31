import { useCallback, useEffect, useState } from 'react';

export interface PollDeepLink {
  focusPollId: string | null;
  presetAnswer: 'yes' | 'no' | null;
  /**
   * Group the focused poll belongs to. Carried in the URL (not just localStorage) because
   * the service worker's notificationclick routing has no access to the page's
   * localStorage — the URL is the only channel that reaches it (fix round 1, Task 7).
   * `null` when the push predates this fix or the group id didn't validate as a UUID.
   */
  groupId: string | null;
  /**
   * Clears the in-memory link and the `pollId`/`answer`/`groupId` URL params (any other
   * query params are preserved). Call this once the mazo is actually done with the
   * focused question (its `onDismiss`) rather than as soon as the values are read, so a
   * refresh mid-flow can still recover the deep link instead of silently losing it.
   */
  clear: () => void;
}

/**
 * Reads `pollId` / `answer` / `groupId` from the current URL once, on mount — set by
 * `navigateFromPush` (native/web push) or the service worker's notification-click
 * routing before handing off to a hard page navigation (Task 7/8). `answer` only ever
 * carries 'yes' | 'no' (from web notification action buttons); any other value is
 * ignored rather than treated as an error, per spec.
 *
 * Both producers already validate `pollId`/`groupId` as UUIDs before putting them in the
 * URL, so this hook does not re-validate on read: `focusPollId` is only ever compared
 * with `===` against real poll ids (Mazo's queue reorder), and `groupId` only against
 * real group ids (`useAutoSelectGroup`'s `.find()`) — both inert by construction if
 * garbage, no storage write or render depends on the raw value.
 */
export function usePollDeepLink(): PollDeepLink {
  const [focusPollId, setFocusPollId] = useState<string | null>(null);
  const [presetAnswer, setPresetAnswer] = useState<'yes' | 'no' | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pollId = params.get('pollId');
    const answer = params.get('answer');
    const group = params.get('groupId');
    if (pollId) setFocusPollId(pollId);
    if (answer === 'yes' || answer === 'no') setPresetAnswer(answer);
    if (group) setGroupId(group);
  }, []);

  const clear = useCallback(() => {
    setFocusPollId(null);
    setPresetAnswer(null);
    setGroupId(null);

    const params = new URLSearchParams(window.location.search);
    if (!params.has('pollId') && !params.has('answer') && !params.has('groupId')) return;
    params.delete('pollId');
    params.delete('answer');
    params.delete('groupId');
    const query = params.toString();
    window.history.replaceState(null, '', window.location.pathname + (query ? `?${query}` : ''));
  }, []);

  return { focusPollId, presetAnswer, groupId, clear };
}
