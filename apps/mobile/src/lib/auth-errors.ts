import i18n from '../i18n';

const ERROR_KEY_MAP: Record<string, string> = {
  'Invalid login credentials': 'authErrors.invalidCredentials',
  'Email not confirmed': 'authErrors.emailNotConfirmed',
  'User already registered': 'authErrors.userAlreadyRegistered',
  'Password should be at least 6 characters': 'authErrors.passwordTooShort',
  'Unable to validate email address: invalid format': 'authErrors.invalidEmailFormat',
  'Signup requires a valid password': 'authErrors.passwordRequired',
  'To signup, please provide your email': 'authErrors.emailRequired',
  'User not found': 'authErrors.userNotFound',
  'For security purposes, you can only request this once every 60 seconds': 'authErrors.rateLimitSeconds',
  'Email rate limit exceeded': 'authErrors.rateLimitExceeded',
};

export function translateAuthError(error: unknown): string {
  if (!(error instanceof Error)) return i18n.t('common.unexpectedError');
  const key = ERROR_KEY_MAP[error.message];
  return key ? i18n.t(key) : error.message;
}

/**
 * True when signing in failed only because the account is still unconfirmed.
 *
 * That one is not a dead end like a wrong password: the screen can offer another
 * confirmation email instead of the flat "credenciales incorrectas". supabase-js
 * carries the reason in `code`, but older backends only set the message, so both
 * are accepted.
 */
export function isEmailNotConfirmed(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const { code } = error as Error & { code?: unknown };
  return code === 'email_not_confirmed' || error.message === 'Email not confirmed';
}
