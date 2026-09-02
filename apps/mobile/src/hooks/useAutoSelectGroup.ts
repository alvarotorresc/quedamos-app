import { useEffect, useRef } from 'react';
import { useGroupStore } from '../stores/group';
import type { Group } from '../services/groups';

/**
 * Picks which group is "current" once the user's groups have loaded. Extracted out of
 * CalendarPage so this priority logic is unit-testable in isolation — CalendarPage has no
 * test harness of its own (500+ lines, many unrelated data dependencies), same reasoning
 * as `usePollDeepLink`.
 *
 * Priority:
 *  1. A deep-link `groupId` from the URL (Task 7 fix round 1) — the only channel that
 *     survives the service worker's `notificationclick` path, which has no access to
 *     `localStorage` (unlike `navigateFromPush`, which also persists it there). Consumed
 *     at most once per mount via a ref, so once applied it never fights a later manual
 *     group switch — the deep link's job is done as soon as it has picked the group once.
 *  2. Whatever's already selected, if it's still one of the user's groups.
 *  3. The persisted group id from a previous session.
 *  4. The first group, as a last resort.
 */
export function useAutoSelectGroup(groups: Group[] | undefined, deepLinkGroupId: string | null): void {
  const currentGroup = useGroupStore((s) => s.currentGroup);
  const setCurrentGroup = useGroupStore((s) => s.setCurrentGroup);
  const getPersistedGroupId = useGroupStore((s) => s.getPersistedGroupId);

  const deepLinkConsumed = useRef(false);

  useEffect(() => {
    if (!groups) return;
    if (groups.length === 0) {
      // Left or was removed from the last group: nothing selectable remains.
      if (currentGroup) setCurrentGroup(null);
      return;
    }

    if (!deepLinkConsumed.current && deepLinkGroupId) {
      deepLinkConsumed.current = true;
      const match = groups.find((g) => g.id === deepLinkGroupId);
      if (match) {
        setCurrentGroup(match);
        return;
      }
      // No match (deleted group, stale/foreign link) — fall through to the usual rules.
    }

    if (currentGroup && groups.find((g) => g.id === currentGroup.id)) return;

    const persistedId = getPersistedGroupId();
    const persistedMatch = persistedId ? groups.find((g) => g.id === persistedId) : null;
    setCurrentGroup(persistedMatch ?? groups[0]);
  }, [groups, currentGroup, setCurrentGroup, getPersistedGroupId, deepLinkGroupId]);
}
