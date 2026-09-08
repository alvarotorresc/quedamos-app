import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  REQUIRED_ENV_VARS,
  readEnv,
  getMissingEnvVars,
  warnMissingEnvVars,
  getFirebaseWebConfig,
  firebaseSwConfigParams,
} from './env';

function stubAll(overrides: Record<string, string> = {}): void {
  for (const name of REQUIRED_ENV_VARS) {
    vi.stubEnv(name, overrides[name] ?? `value-for-${name}`);
  }
  vi.stubEnv('VITE_FIREBASE_MEASUREMENT_ID', overrides.VITE_FIREBASE_MEASUREMENT_ID ?? 'G-TEST');
}

describe('env', () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.unstubAllEnvs();
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    warn.mockRestore();
  });

  describe('readEnv', () => {
    it('reads the value when it is set', () => {
      vi.stubEnv('VITE_API_URL', 'https://api.quedamos.test');

      expect(readEnv('VITE_API_URL')).toBe('https://api.quedamos.test');
    });

    it('treats a blank value as missing', () => {
      vi.stubEnv('VITE_FIREBASE_VAPID_KEY', '   ');

      expect(readEnv('VITE_FIREBASE_VAPID_KEY')).toBeUndefined();
    });

    it('trims the value so a trailing newline from the CI secret does not travel', () => {
      vi.stubEnv('VITE_SUPABASE_ANON_KEY', ' anon-key\n');

      expect(readEnv('VITE_SUPABASE_ANON_KEY')).toBe('anon-key');
    });
  });

  describe('getMissingEnvVars', () => {
    it('returns nothing when everything is set', () => {
      stubAll();

      expect(getMissingEnvVars()).toEqual([]);
    });

    it('lists exactly the variables that are missing', () => {
      stubAll();
      vi.stubEnv('VITE_FIREBASE_VAPID_KEY', '');
      vi.stubEnv('VITE_SUPABASE_URL', '');

      expect(getMissingEnvVars().sort()).toEqual(['VITE_FIREBASE_VAPID_KEY', 'VITE_SUPABASE_URL']);
    });

    it('does not require the measurement id, which is analytics-only', () => {
      stubAll();
      vi.stubEnv('VITE_FIREBASE_MEASUREMENT_ID', '');

      expect(getMissingEnvVars()).toEqual([]);
    });
  });

  describe('warnMissingEnvVars', () => {
    it('warns once per missing variable, naming it', () => {
      stubAll();
      vi.stubEnv('VITE_FIREBASE_APP_ID', '');

      const missing = warnMissingEnvVars();

      expect(missing).toEqual(['VITE_FIREBASE_APP_ID']);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0][0])).toContain('VITE_FIREBASE_APP_ID');
    });

    it('warns even outside DEV — a production build missing a var is the whole point', () => {
      stubAll();
      vi.stubEnv('DEV', '');
      vi.stubEnv('PROD', 'true');
      vi.stubEnv('VITE_API_URL', '');

      warnMissingEnvVars();

      expect(warn).toHaveBeenCalledTimes(1);
    });

    it('says nothing when the env is complete', () => {
      stubAll();

      expect(warnMissingEnvVars()).toEqual([]);
      expect(warn).not.toHaveBeenCalled();
    });
  });

  describe('getFirebaseWebConfig', () => {
    it('builds the config out of the env', () => {
      stubAll({
        VITE_FIREBASE_API_KEY: 'key',
        VITE_FIREBASE_AUTH_DOMAIN: 'app.firebaseapp.com',
        VITE_FIREBASE_PROJECT_ID: 'app-1',
        VITE_FIREBASE_MESSAGING_SENDER_ID: '123',
        VITE_FIREBASE_APP_ID: '1:123:web:abc',
        VITE_FIREBASE_MEASUREMENT_ID: 'G-1',
      });

      expect(getFirebaseWebConfig()).toEqual({
        apiKey: 'key',
        authDomain: 'app.firebaseapp.com',
        projectId: 'app-1',
        messagingSenderId: '123',
        appId: '1:123:web:abc',
        measurementId: 'G-1',
      });
    });
  });

  describe('firebaseSwConfigParams', () => {
    it('forwards everything the worker needs to initialise messaging', () => {
      stubAll({
        VITE_FIREBASE_API_KEY: 'key',
        VITE_FIREBASE_AUTH_DOMAIN: 'app.firebaseapp.com',
        VITE_FIREBASE_PROJECT_ID: 'app-1',
        VITE_FIREBASE_MESSAGING_SENDER_ID: '123',
        VITE_FIREBASE_APP_ID: '1:123:web:abc',
      });

      const params = new URLSearchParams(firebaseSwConfigParams());

      expect(params.get('apiKey')).toBe('key');
      expect(params.get('authDomain')).toBe('app.firebaseapp.com');
      expect(params.get('projectId')).toBe('app-1');
      expect(params.get('messagingSenderId')).toBe('123');
      expect(params.get('appId')).toBe('1:123:web:abc');
    });

    it('leaves the measurement id out — analytics never runs in the worker', () => {
      stubAll({ VITE_FIREBASE_MEASUREMENT_ID: 'G-1' });

      expect(new URLSearchParams(firebaseSwConfigParams()).get('measurementId')).toBeNull();
    });

    it('omits what is missing instead of writing "undefined" into the URL', () => {
      stubAll();
      vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', '');

      const query = firebaseSwConfigParams();

      expect(query).not.toContain('undefined');
      expect(new URLSearchParams(query).has('authDomain')).toBe(false);
    });
  });
});
