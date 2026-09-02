/** Where auth flows land when no usable `?redirect=` came with them. */
const DEFAULT_REDIRECT = '/tabs';

// Tabs, newlines and other control characters are stripped by the browser before
// the URL is parsed, so "/\n/evil.com" reaches the router as "//evil.com".
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

/**
 * Narrows a `?redirect=` parameter to somewhere inside this app.
 *
 * Only a path starting with a single `/` is kept: that rules out absolute URLs
 * (`http://evil.com`), scheme tricks (`javascript:…`) and the protocol-relative
 * forms a browser normalizes back into one (`//evil.com`, `/\evil.com`). Anything
 * else falls back, so an invite link can carry a destination without becoming an
 * open redirect.
 */
export function safeRedirect(raw: string | null | undefined, fallback = DEFAULT_REDIRECT): string {
  if (!raw) return fallback;
  if (CONTROL_CHARS.test(raw)) return fallback;
  if (!raw.startsWith('/')) return fallback;
  if (raw.startsWith('//') || raw.startsWith('/\\')) return fallback;
  return raw;
}
