/**
 * Sanitize a URL for safe use in href attributes.
 * Only allows http: and https: protocols.
 * Returns undefined for any other scheme (javascript:, data:, vbscript:, etc.)
 */
export function sanitizeUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return url;
    }
    return undefined;
  } catch {
    // Invalid URL — reject
    return undefined;
  }
}
