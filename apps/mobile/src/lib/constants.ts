// The public web URL, used as the redirect base for Supabase auth flows on native
// platforms. Capacitor's WebView reports `window.location.origin` as
// `https://localhost`, which isn't in Supabase's redirect allowlist, so native auth
// redirects must use this canonical URL instead.
export const PUBLIC_WEB_URL = 'https://quedamos-app-mobile.vercel.app';

export const MEMBER_COLORS = [
  '#60A5FA',
  '#F59E0B',
  '#F472B6',
  '#34D399',
  '#A78BFA',
  '#FB7185',
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
