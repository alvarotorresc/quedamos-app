import { MEMBER_COLORS } from './constants';

interface MemberLike {
  userId: string;
  joinedAt: string;
}

export function memberColorByIndex(index: number): string {
  return MEMBER_COLORS[index % MEMBER_COLORS.length];
}

/**
 * Color por posición dentro del grupo (spec §5.1): orden de entrada
 * (joinedAt asc, desempate por userId), sin repetición hasta el séptimo.
 * Sustituye al hash global, que podía repetir color dentro de un grupo.
 */
export function buildMemberColorMap(members: MemberLike[]): Map<string, string> {
  const sorted = [...members].sort(
    (a, b) => a.joinedAt.localeCompare(b.joinedAt) || a.userId.localeCompare(b.userId),
  );
  return new Map(sorted.map((m, i) => [m.userId, memberColorByIndex(i)]));
}
