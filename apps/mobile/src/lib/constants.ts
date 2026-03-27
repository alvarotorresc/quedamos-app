export const MEMBER_COLORS = [
  '#60A5FA',
  '#F59E0B',
  '#F472B6',
  '#34D399',
  '#A78BFA',
  '#FB7185',
] as const;

export const MEMBER_GRADIENTS = [
  'linear-gradient(135deg, #60A5FA, #3B82F6)',
  'linear-gradient(135deg, #FBBF24, #F59E0B)',
  'linear-gradient(135deg, #F472B6, #EC4899)',
  'linear-gradient(135deg, #34D399, #10B981)',
  'linear-gradient(135deg, #A78BFA, #8B5CF6)',
  'linear-gradient(135deg, #FB7185, #F43F5E)',
] as const;

export const MEMBER_GLOWS = [
  'rgba(96, 165, 250, 0.3)',
  'rgba(245, 158, 11, 0.3)',
  'rgba(244, 114, 182, 0.3)',
  'rgba(52, 211, 153, 0.3)',
  'rgba(167, 139, 250, 0.3)',
  'rgba(251, 113, 133, 0.3)',
] as const;

export function getMemberColor(index: number): string {
  return MEMBER_COLORS[index % MEMBER_COLORS.length];
}

export function getMemberGradient(index: number): string {
  return MEMBER_GRADIENTS[index % MEMBER_GRADIENTS.length];
}

export function getMemberGlow(index: number): string {
  return MEMBER_GLOWS[index % MEMBER_GLOWS.length];
}
