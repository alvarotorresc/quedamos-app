/* eslint-disable @typescript-eslint/no-require-imports */
describe('instrument', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should call Sentry.init with correct config when DSN is set', () => {
    process.env.SENTRY_DSN = 'https://examplePublicKey@o0.ingest.sentry.io/0';
    process.env.NODE_ENV = 'production';

    const mockInit = jest.fn();
    jest.doMock('@sentry/nestjs', () => ({ init: mockInit }));

    require('./instrument');

    expect(mockInit).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: 'https://examplePublicKey@o0.ingest.sentry.io/0',
        environment: 'production',
        tracesSampleRate: 0.2,
        enabled: true,
        beforeSend: expect.any(Function),
      }),
    );
  });

  it('should disable Sentry when DSN is not set', () => {
    delete process.env.SENTRY_DSN;
    process.env.NODE_ENV = 'test';

    const mockInit = jest.fn();
    jest.doMock('@sentry/nestjs', () => ({ init: mockInit }));

    require('./instrument');

    expect(mockInit).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
      }),
    );
  });

  it('should default environment to development when NODE_ENV is not set', () => {
    process.env.SENTRY_DSN = 'https://examplePublicKey@o0.ingest.sentry.io/0';
    delete process.env.NODE_ENV;

    const mockInit = jest.fn();
    jest.doMock('@sentry/nestjs', () => ({ init: mockInit }));

    require('./instrument');

    expect(mockInit).toHaveBeenCalledWith(
      expect.objectContaining({
        environment: 'development',
      }),
    );
  });

  it('should use custom tracesSampleRate from env var', () => {
    process.env.SENTRY_DSN = 'https://examplePublicKey@o0.ingest.sentry.io/0';
    process.env.SENTRY_TRACES_SAMPLE_RATE = '0.5';

    const mockInit = jest.fn();
    jest.doMock('@sentry/nestjs', () => ({ init: mockInit }));

    require('./instrument');

    expect(mockInit).toHaveBeenCalledWith(
      expect.objectContaining({
        tracesSampleRate: 0.5,
      }),
    );
  });

  it('should not crash if Sentry.init throws', () => {
    process.env.SENTRY_DSN = 'https://examplePublicKey@o0.ingest.sentry.io/0';

    jest.doMock('@sentry/nestjs', () => ({
      init: jest.fn(() => {
        throw new Error('Sentry init failed');
      }),
    }));

    expect(() => require('./instrument')).toThrow('Sentry init failed');
  });

  describe('beforeSend redaction', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function loadBeforeSend(): (event: any) => any {
      process.env.SENTRY_DSN = 'https://examplePublicKey@o0.ingest.sentry.io/0';
      const mockInit = jest.fn();
      jest.doMock('@sentry/nestjs', () => ({ init: mockInit }));
      require('./instrument');
      return mockInit.mock.calls[0][0].beforeSend;
    }

    function scrubValue(value: string): string {
      const event = loadBeforeSend()({ exception: { values: [{ value }] } });
      return event.exception.values[0].value;
    }

    it('redacts a JWT in the exception message', () => {
      expect(scrubValue('jwt malformed: eyJhbGciOiJIUzI1.eyJzdWIiOiIxIn0.sIgNaTuRe')).toBe(
        'jwt malformed: [JWT_REDACTED]',
      );
    });

    it('redacts an email address', () => {
      expect(scrubValue('user alvaro@example.com not found')).toBe(
        'user [EMAIL_REDACTED] not found',
      );
    });

    it('redacts a widget token', () => {
      expect(scrubValue(`invalid token qw_${'a'.repeat(48)}`)).toBe(
        'invalid token [WIDGET_TOKEN_REDACTED]',
      );
    });

    it('redacts a bearer credential that is not a JWT', () => {
      expect(scrubValue('Request failed with Bearer sk-live-abc123def456')).toBe(
        'Request failed with Bearer [REDACTED]',
      );
    });

    it('redacts token-bearing query parameters in a URL', () => {
      expect(scrubValue('GET /widget/summary?token=abc123&groupId=g-1 failed')).toBe(
        'GET /widget/summary?token=[REDACTED]&groupId=g-1 failed',
      );
    });

    it('redacts the Authorization and Cookie request headers', () => {
      const event = loadBeforeSend()({
        request: {
          headers: {
            Authorization: 'Bearer eyJhbGciOiJIUzI1.eyJzdWIiOiIxIn0.sIgNaTuRe',
            Cookie: 'sb-access-token=abc123',
            'User-Agent': 'jest',
          },
        },
      });

      expect(event.request.headers.Authorization).toBe('[REDACTED]');
      expect(event.request.headers.Cookie).toBe('[REDACTED]');
      expect(event.request.headers['User-Agent']).toBe('jest');
    });

    it('redacts the request url, query string and cookies', () => {
      const event = loadBeforeSend()({
        request: {
          url: 'https://api.example.com/widget/summary?token=abc123',
          query_string: 'token=abc123&date=2026-09-02',
          cookies: { 'sb-access-token': 'abc123' },
        },
      });

      expect(event.request.url).toBe('https://api.example.com/widget/summary?token=[REDACTED]');
      expect(event.request.query_string).toBe('token=[REDACTED]&date=2026-09-02');
      expect(event.request.cookies).toBeUndefined();
    });

    it('returns the event even when there is nothing to redact', () => {
      const event = loadBeforeSend()({ message: 'plain' });
      expect(event).toEqual({ message: 'plain' });
    });
  });
});
