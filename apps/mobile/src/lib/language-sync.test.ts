import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from './supabase';
import { registerLanguageSync, syncLanguageToProfile } from './language-sync';

function fakeI18n() {
  const listeners = new Set<(lng: string) => void>();
  return {
    on: vi.fn((_event: 'languageChanged', listener: (lng: string) => void) => {
      listeners.add(listener);
    }),
    off: vi.fn((_event: 'languageChanged', listener: (lng: string) => void) => {
      listeners.delete(listener);
    }),
    emit: (lng: string) => listeners.forEach((listener) => listener(lng)),
    count: () => listeners.size,
  };
}

describe('language-sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: 'user-1' } } },
    } as never);
    vi.mocked(supabase.auth.updateUser).mockResolvedValue({ data: {}, error: null } as never);
  });

  describe('syncLanguageToProfile', () => {
    it('should store the language in the Supabase profile', async () => {
      await syncLanguageToProfile('en');

      expect(supabase.auth.updateUser).toHaveBeenCalledWith({ data: { language: 'en' } });
    });

    it('should normalize a regional tag to its base language', async () => {
      await syncLanguageToProfile('en-GB');

      expect(supabase.auth.updateUser).toHaveBeenCalledWith({ data: { language: 'en' } });
    });

    it('should ignore a language the API has no copy for', async () => {
      await syncLanguageToProfile('fr');

      expect(supabase.auth.getSession).not.toHaveBeenCalled();
      expect(supabase.auth.updateUser).not.toHaveBeenCalled();
    });

    it('should do nothing when nobody is signed in', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
      } as never);

      await syncLanguageToProfile('en');

      expect(supabase.auth.updateUser).not.toHaveBeenCalled();
    });

    it('should swallow a failed sync: switching the language must still work offline', async () => {
      vi.mocked(supabase.auth.updateUser).mockRejectedValue(new Error('offline'));

      await expect(syncLanguageToProfile('en')).resolves.toBeUndefined();
    });
  });

  // Booting the app is not a language change: i18next resolves the initial language
  // during init(), before the listener is attached. If that ever stopped being true,
  // every launch would spend a Supabase write (and a fresh JWT) on an unchanged value.
  describe('boot', () => {
    it('should not write the profile just for loading i18n', async () => {
      await import('../i18n');
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(supabase.auth.updateUser).not.toHaveBeenCalled();
    });
  });

  describe('registerLanguageSync', () => {
    it('should push the new language on languageChanged', async () => {
      const i18n = fakeI18n();
      registerLanguageSync(i18n);

      i18n.emit('en');
      await vi.waitFor(() =>
        expect(supabase.auth.updateUser).toHaveBeenCalledWith({ data: { language: 'en' } }),
      );
    });

    it('should stop listening once unregistered', () => {
      const i18n = fakeI18n();
      const unregister = registerLanguageSync(i18n);

      unregister();

      expect(i18n.count()).toBe(0);
    });
  });
});
