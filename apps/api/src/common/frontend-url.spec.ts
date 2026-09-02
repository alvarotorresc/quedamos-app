import {
  corsOrigins,
  DEFAULT_FRONTEND_URL,
  getFrontendUrl,
  LEGACY_FRONTEND_URL,
} from './frontend-url';

describe('getFrontendUrl', () => {
  afterEach(() => {
    delete process.env.FRONTEND_URL;
  });

  it('falls back to the default frontend url when FRONTEND_URL is unset', () => {
    delete process.env.FRONTEND_URL;

    expect(getFrontendUrl()).toBe('https://quedamos.alvarotc.com');
  });

  it('uses FRONTEND_URL when set', () => {
    process.env.FRONTEND_URL = 'https://custom.example.com';

    expect(getFrontendUrl()).toBe('https://custom.example.com');
  });
});

describe('corsOrigins', () => {
  it('allows the frontend and the Capacitor origin in production only', () => {
    const origins = corsOrigins({ NODE_ENV: 'production' });

    expect(origins).toContain(DEFAULT_FRONTEND_URL);
    expect(origins).toContain('https://localhost');
    expect(origins).not.toContain('http://localhost:5173');
  });

  it('keeps allowing the legacy vercel host while old links are still around', () => {
    const origins = corsOrigins({ NODE_ENV: 'production' });

    expect(DEFAULT_FRONTEND_URL).toBe('https://quedamos.alvarotc.com');
    expect(LEGACY_FRONTEND_URL).toBe('https://quedamos-app-mobile.vercel.app');
    expect(origins).toContain(LEGACY_FRONTEND_URL);
  });

  it('adds the local dev servers outside production', () => {
    const origins = corsOrigins({ NODE_ENV: 'development' });

    expect(origins).toEqual(
      expect.arrayContaining([
        'http://localhost:5173',
        'http://localhost:8100',
        'http://localhost',
      ]),
    );
  });

  it('appends CORS_ORIGIN when set', () => {
    const origins = corsOrigins({
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://extra.example.com',
    });

    expect(origins).toContain('https://extra.example.com');
  });
});
