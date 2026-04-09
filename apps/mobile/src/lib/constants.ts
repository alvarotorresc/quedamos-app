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

function hashUserId(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function getMemberColorByUserId(userId: string): string {
  return MEMBER_COLORS[hashUserId(userId) % MEMBER_COLORS.length];
}

export function getMemberGradientByUserId(userId: string): string {
  return MEMBER_GRADIENTS[hashUserId(userId) % MEMBER_GRADIENTS.length];
}

export function getMemberGlowByUserId(userId: string): string {
  return MEMBER_GLOWS[hashUserId(userId) % MEMBER_GLOWS.length];
}
