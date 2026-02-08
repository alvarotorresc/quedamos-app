import { useGroupStore } from '../stores/group';
import { useGroup } from './useGroups';
import { useAuthStore } from '../stores/auth';

const MEMBER_COLORS = ['#60A5FA', '#F59E0B', '#F472B6', '#34D399', '#A78BFA', '#FB7185'];

export function useMyColor(): string {
  const user = useAuthStore((s) => s.user);
  const currentGroup = useGroupStore((s) => s.currentGroup);
  const { data: groupDetail } = useGroup(currentGroup?.id ?? '');

  if (!user || !groupDetail?.members) return MEMBER_COLORS[0];

  const index = groupDetail.members.findIndex((m) => m.userId === user.id);
  return MEMBER_COLORS[index >= 0 ? index % MEMBER_COLORS.length : 0];
}
