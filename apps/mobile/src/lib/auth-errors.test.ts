import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock i18n before importing the module under test
vi.mock('../i18n', () => ({
  default: {
    t: vi.fn((key: string) => key),
  },
}));

import i18n from '../i18n';
import { translateAuthError } from './auth-errors';

describe('translateAuthError', () => {
  beforeEach(() => {
    vi.mocked(i18n.t).mockImplementation(((key: string) => key) as any);
  });

  describe('known error messages', () => {
    const knownErrors: Array<[string, string]> = [
      ['Invalid login credentials', 'authErrors.invalidCredentials'],
      ['Email not confirmed', 'authErrors.emailNotConfirmed'],
      ['User already registered', 'authErrors.userAlreadyRegistered'],
      [
        'Password should be at least 6 characters',
        'authErrors.passwordTooShort',
      ],
      [
        'Unable to validate email address: invalid format',
        'authErrors.invalidEmailFormat',
      ],
      ['Signup requires a valid password', 'authErrors.passwordRequired'],
      [
        'To signup, please provide your email',
        'authErrors.emailRequired',
      ],
      ['User not found', 'authErrors.userNotFound'],
      [
        'For security purposes, you can only request this once every 60 seconds',
        'authErrors.rateLimitSeconds',
      ],
      ['Email rate limit exceeded', 'authErrors.rateLimitExceeded'],
    ];

    it.each(knownErrors)(
      'should translate "%s" to "%s"',
      (message, expectedKey) => {
        const error = new Error(message);

        translateAuthError(error);

        expect(i18n.t).toHaveBeenCalledWith(expectedKey);
      },
    );
  });

  describe('unknown error messages', () => {
    it('should return the raw error message for unknown errors', () => {
      const error = new Error('Some unknown Supabase error');

      const result = translateAuthError(error);

      // Unknown errors are NOT passed through i18n.t; the raw message is returned
      expect(result).toBe('Some unknown Supabase error');
    });

    it('should return the raw message for an empty error', () => {
      const error = new Error('');

      const result = translateAuthError(error);

      // Empty string key is not in the map, so raw message is returned
      expect(result).toBe('');
    });
  });

  describe('non-Error inputs', () => {
    it('should return unexpectedError key for a string input', () => {
      translateAuthError('something went wrong');

      expect(i18n.t).toHaveBeenCalledWith('common.unexpectedError');
    });

    it('should return unexpectedError key for null', () => {
      translateAuthError(null);

      expect(i18n.t).toHaveBeenCalledWith('common.unexpectedError');
    });

    it('should return unexpectedError key for undefined', () => {
      translateAuthError(undefined);

      expect(i18n.t).toHaveBeenCalledWith('common.unexpectedError');
    });

    it('should return unexpectedError key for a plain object', () => {
      translateAuthError({ message: 'Invalid login credentials' });

      expect(i18n.t).toHaveBeenCalledWith('common.unexpectedError');
    });

    it('should return unexpectedError key for a number', () => {
      translateAuthError(42);

      expect(i18n.t).toHaveBeenCalledWith('common.unexpectedError');
    });
  });

  describe('partial matches', () => {
    it('should NOT match a partial substring of a known error', () => {
      // The map uses exact key matching, so partial matches return the raw message
      const error = new Error(
        'Invalid login credentials: account locked',
      );

      const result = translateAuthError(error);

      expect(result).toBe('Invalid login credentials: account locked');
    });

    it('should NOT match when the message has extra prefix', () => {
      const error = new Error('Error: Email not confirmed');

      const result = translateAuthError(error);

      expect(result).toBe('Error: Email not confirmed');
    });
  });
});
