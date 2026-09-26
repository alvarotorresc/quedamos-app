export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;
export type Sleep = (ms: number) => Promise<void>;

export interface RequestOptions {
  headers?: Record<string, string>;
  body?: unknown;
}

export type Requester = <T>(method: string, url: string, options?: RequestOptions) => Promise<T>;

export class HttpError extends Error {
  readonly status: number;
  readonly method: string;
  readonly path: string;

  constructor(status: number, method: string, path: string, detail: string) {
    super(`${method} ${path} -> ${status}${detail ? `: ${detail}` : ''}`);
    this.name = 'HttpError';
    this.status = status;
    this.method = method;
    this.path = path;
  }
}

const GLOBAL_GAP_MS = 700;
const MAX_RETRIES = 2;
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** Hueco mínimo entre dos llamadas a la misma ruta, según los @Throttle de la API (por IP). */
export function paceFor(method: string, path: string): number {
  if (method === 'DELETE' && path.endsWith('/auth/me')) return 21000;
  if (method === 'POST' && path.endsWith('/groups/join')) return 13000;
  if (method === 'POST' && /\/(events|proposals|polls)$/.test(path)) return 6500;
  if (method === 'POST' && /\/availability$/.test(path)) return 3500;
  if (method === 'POST' && /\/(vote|respond)$/.test(path)) return 3500;
  return GLOBAL_GAP_MS;
}

export function retryAfterMs(header: string | null): number {
  const seconds = Number(header);
  return header !== null && Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : 60000;
}

const realSleep: Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createRequester(deps: { fetch?: FetchLike; sleep?: Sleep; now?: () => number } = {}): Requester {
  const doFetch: FetchLike = deps.fetch ?? ((url, init) => fetch(url, init));
  const sleep = deps.sleep ?? realSleep;
  const clock = deps.now ?? (() => Date.now());
  const lastByRoute = new Map<string, number>();
  let lastAny = Number.NEGATIVE_INFINITY;

  async function request<T>(method: string, url: string, options: RequestOptions = {}): Promise<T> {
    const path = new URL(url).pathname;
    const routeKey = `${method} ${path.replace(UUID_RE, ':id')}`;
    for (let attempt = 0; ; attempt++) {
      const lastRoute = lastByRoute.get(routeKey) ?? Number.NEGATIVE_INFINITY;
      const wait = Math.max(lastRoute + paceFor(method, path) - clock(), lastAny + GLOBAL_GAP_MS - clock(), 0);
      if (wait > 0) await sleep(wait);
      lastByRoute.set(routeKey, clock());
      lastAny = clock();

      const headers: Record<string, string> = { ...options.headers };
      if (options.body !== undefined) headers['content-type'] = 'application/json';
      const response = await doFetch(url, {
        method,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });

      if (response.status === 429 && attempt < MAX_RETRIES) {
        await sleep(retryAfterMs(response.headers.get('retry-after')));
        continue;
      }
      const text = await response.text();
      if (!response.ok) throw new HttpError(response.status, method, path, text.slice(0, 300));
      return (text ? JSON.parse(text) : undefined) as T;
    }
  }

  return request;
}
