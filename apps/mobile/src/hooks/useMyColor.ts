import { useMemo } from 'react';
import { useAuthStore } from '../stores/auth';
import { useGroupStore } from '../stores/group';
import { useGroup, useGroups } from './useGroups';
import { buildMemberColorMap } from '../lib/member-colors';
import { MEMBER_COLORS, getMemberColorByUserId } from '../lib/constants';

/**
 * Member color is PER GROUP by design (spec §5.1): position of join order
 * within a group's member list, not a global identity.
 *
 * This hook resolves the group used for that lookup with a deterministic
 * fallback chain, since the global header avatar has to show *some* color
 * even before the user has an active group selected:
 *   1. the active group (`useGroupStore().currentGroup`), as set by
 *      Calendar/Plans;
 *   2. otherwise the first group from the user's `useGroups()` list (covers
 *      GroupPage on a fresh session or a deep link into /tabs/group, before
 *      `currentGroup` is populated);
 *   3. only if neither exists yet, the documented global hash fallback
 *      (`getMemberColorByUserId`).
 */
export function useMyColor(): string {
  const user = useAuthStore((s) => s.user);
  const storeGroupId = useGroupStore((s) => s.currentGroup?.id);
  const { data: groups } = useGroups();
  const groupId = storeGroupId ?? groups?.[0]?.id ?? '';
  const { data: group } = useGroup(groupId);
  return useMemo(() => {
    if (!user) return MEMBER_COLORS[0];
    const fromGroup = group?.members
      ? buildMemberColorMap(group.members).get(user.id)
      : undefined;
    return fromGroup ?? getMemberColorByUserId(user.id);
  }, [user, group]);
}
