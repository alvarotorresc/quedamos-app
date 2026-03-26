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
});
