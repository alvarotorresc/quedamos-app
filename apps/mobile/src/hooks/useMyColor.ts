import { useAuthStore } from '../stores/auth';
import { getMemberColorByUserId, MEMBER_COLORS } from '../lib/constants';

export function useMyColor(): string {
  const userId = useAuthStore((s) => s.user?.id);
  if (!userId) return MEMBER_COLORS[0];
  return getMemberColorByUserId(userId);
}
