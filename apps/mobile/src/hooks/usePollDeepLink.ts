import { useCallback, useEffect, useState } from 'react';

export interface PollDeepLink {
  focusPollId: string | null;
  presetAnswer: 'yes' | 'no' | null;
  /**
   * Clears both the in-memory link and the `pollId`/`answer` URL params (any other
   * query params are preserved). Call this once the mazo is actually done with the
   * focused question (its `onDismiss`) rather than as soon as the values are read, so a
   * refresh mid-flow can still recover the deep link instead of silently losing it.
   */
  clear: () => void;
}

/**
 * Reads `pollId` / `answer` from the current URL once, on mount — set by
 * `navigateFromPush` (native/web push) or the service worker's notification-click
 * routing before handing off to a hard page navigation (Task 7/8). `answer` only ever
 * carries 'yes' | 'no' (from web notification action buttons); any other value is
 * ignored rather than treated as an error, per spec.
 *
 * Both producers already validate `pollId` as a UUID before putting it in the URL, so
 * this hook does not re-validate on read: a garbage value here is only ever compared
 * with `===` against real poll ids (Mazo's queue reorder) — inert by construction, no
 * storage write or render depends on it.
 */
export function usePollDeepLink(): PollDeepLink {
  const [focusPollId, setFocusPollId] = useState<string | null>(null);
  const [presetAnswer, setPresetAnswer] = useState<'yes' | 'no' | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pollId = params.get('pollId');
    const answer = params.get('answer');
    if (pollId) setFocusPollId(pollId);
    if (answer === 'yes' || answer === 'no') setPresetAnswer(answer);
  }, []);

  const clear = useCallback(() => {
    setFocusPollId(null);
    setPresetAnswer(null);

    const params = new URLSearchParams(window.location.search);
    if (!params.has('pollId') && !params.has('answer')) return;
    params.delete('pollId');
    params.delete('answer');
    const query = params.toString();
    window.history.replaceState(null, '', window.location.pathname + (query ? `?${query}` : ''));
  }, []);

  return { focusPollId, presetAnswer, clear };
}
