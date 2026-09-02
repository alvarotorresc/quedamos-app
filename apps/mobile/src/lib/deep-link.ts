/**
 * Deep links (`appUrlOpen`) que la app nativa acepta.
 *
 * El intent-filter del manifest sólo declara los dos hosts públicos, pero cualquier
 * app instalada puede lanzar un Intent con `VIEW` y una URL arbitraria hacia
 * `MainActivity`, así que la URL que llega a `appUrlOpen` NO es de confianza: hay que
 * validar host y esquema aquí antes de navegar con ella.
 */

/** Hosts que consideramos nuestros. Coincide con el intent-filter del manifest. */
const ALLOWED_HOSTS = ['quedamos.alvarotc.com', 'quedamos-app-mobile.vercel.app'];

/** Rutas que un enlace externo puede abrir (exactas o con subruta). */
const ALLOWED_PATHS = ['/reset-password', '/join', '/tabs'];

function isAllowedPath(pathname: string): boolean {
  return ALLOWED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Devuelve la ruta interna a la que navegar, o `null` si la URL no es de un host
 * nuestro, no es https o apunta fuera de las rutas permitidas.
 */
export function resolveDeepLinkPath(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    // URL inválida — se ignora
    return null;
  }

  if (parsed.protocol !== 'https:') return null;
  if (!ALLOWED_HOSTS.includes(parsed.hostname.toLowerCase())) return null;
  if (!isAllowedPath(parsed.pathname)) return null;

  return parsed.pathname + parsed.search + parsed.hash;
}

/** Navegación real, aislada aquí para poder mockearla en los tests de App. */
export function navigateToDeepLink(path: string): void {
  window.location.href = path;
}
