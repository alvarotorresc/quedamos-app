/**
 * Keeps the language the API writes pushes in aligned with the one the app shows.
 *
 * The interface language lives in i18next (and localStorage); the API reads it from
 * `user_metadata.language` in the Supabase JWT, which it copies onto the user on every
 * request. Without this bridge a user who switches to English keeps receiving Spanish
 * notifications forever.
 */

const SUPPORTED_LANGUAGES = ['es', 'en'] as const;

type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** What `registerLanguageSync` needs from i18next — kept minimal so it is easy to fake. */
export interface LanguageEmitter {
  on(event: 'languageChanged', listener: (language: string) => void): void;
  off(event: 'languageChanged', listener: (language: string) => void): void;
}

/** 'en-GB' and 'en' are the same language as far as the push copy is concerned. */
function toSupportedLanguage(language: string): SupportedLanguage | null {
  const base = language.split('-')[0].toLowerCase();
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(base)
    ? (base as SupportedLanguage)
    : null;
}

/**
 * Writes the language onto the Supabase profile. Never rejects: a language switch is a
 * local, instant action and must not fail because the network is down — the next request
 * with a refreshed token syncs it anyway.
 */
export async function syncLanguageToProfile(language: string): Promise<void> {
  const supported = toSupportedLanguage(language);
  if (!supported) return;

  try {
    // Imported lazily: i18n is initialised at module load, before the Supabase client is
    // needed, and a static import would drag it into that cycle.
    const { supabase } = await import('./supabase');
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;

    await supabase.auth.updateUser({ data: { language: supported } });
  } catch {
    // Nothing to do: the language is already applied locally.
  }
}

/** Subscribes to i18next language changes. Returns the unsubscribe. */
export function registerLanguageSync(i18n: LanguageEmitter): () => void {
  const listener = (language: string) => {
    void syncLanguageToProfile(language);
  };

  i18n.on('languageChanged', listener);

  return () => i18n.off('languageChanged', listener);
}
