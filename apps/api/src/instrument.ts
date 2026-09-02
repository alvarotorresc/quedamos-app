import * as Sentry from '@sentry/nestjs';

const REDACTED = '[REDACTED]';

/** Headers whose whole value is a credential: never worth partially scrubbing. */
const SENSITIVE_HEADERS = [
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
];

/** Query parameters that carry a credential rather than a filter. */
const SENSITIVE_QUERY_KEYS =
  'token|access_token|refresh_token|id_token|api_key|apikey|key|code|secret|password';

/**
 * Strips credentials and personal data from anything that reaches Sentry. The exception
 * message is not the only place they show up: a stack trace can quote a URL, and the
 * request context carries the headers and the query string verbatim.
 */
function scrub(text: string): string {
  return (
    text
      // Supabase JWTs.
      .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g, '[JWT_REDACTED]')
      // Widget tokens: they authenticate outside the AuthGuard.
      .replace(/qw_[0-9a-fA-F]{8,}/g, '[WIDGET_TOKEN_REDACTED]')
      // Any other bearer credential.
      .replace(/\b(bearer)(\s+)[A-Za-z0-9._~+/=-]+/gi, `$1$2${REDACTED}`)
      // Credentials passed as query parameters.
      .replace(
        new RegExp(`(^|[?&])((?:${SENSITIVE_QUERY_KEYS})=)[^&\\s]+`, 'gi'),
        `$1$2${REDACTED}`,
      )
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_REDACTED]')
  );
}

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.2'),
  enabled: !!process.env.SENTRY_DSN,
  beforeSend(event) {
    if (event.message) {
      event.message = scrub(event.message);
    }

    for (const ex of event.exception?.values ?? []) {
      if (ex.value) {
        ex.value = scrub(ex.value);
      }
    }

    const request = event.request;
    if (request) {
      if (request.headers) {
        for (const [name, value] of Object.entries(request.headers)) {
          request.headers[name] = SENSITIVE_HEADERS.includes(name.toLowerCase())
            ? REDACTED
            : scrub(value);
        }
      }
      if (typeof request.url === 'string') {
        request.url = scrub(request.url);
      }
      if (typeof request.query_string === 'string') {
        request.query_string = scrub(request.query_string);
      }
      // Cookies are session credentials end to end; there is nothing to keep.
      request.cookies = undefined;
    }

    return event;
  },
});
