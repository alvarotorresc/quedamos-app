/**
 * Language a push notification is written in. It lives on `User.language` and is kept
 * in sync from the Supabase JWT (`user_metadata.language`), which the app updates when
 * the user switches the interface language.
 */
export const PUSH_LANGUAGES = ['es', 'en'] as const;

export type PushLanguage = (typeof PUSH_LANGUAGES)[number];

/** Spanish is the language the product was written in, and the DB default. */
export const DEFAULT_PUSH_LANGUAGE: PushLanguage = 'es';

export function isPushLanguage(value: unknown): value is PushLanguage {
  return typeof value === 'string' && (PUSH_LANGUAGES as readonly string[]).includes(value);
}

/** Anything unknown, missing or stale falls back to Spanish rather than to no push at all. */
export function normalizePushLanguage(value: unknown): PushLanguage {
  return isPushLanguage(value) ? value : DEFAULT_PUSH_LANGUAGE;
}
