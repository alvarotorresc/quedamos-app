import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Capacitor } from '@capacitor/core';
import { useAuthStore } from './auth';
import { supabase } from '../lib/supabase';
import { syncWidgetSession, clearWidgetSession } from '../lib/widget-bridge';
import { savePendingRedirect, takePendingRedirect } from '../lib/pending-redirect';

type GetSessionResult = Awaited<ReturnType<typeof supabase.auth.getSession>>;
type SignInResult = Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>;
type UpdateUserResult = Awaited<ReturnType<typeof supabase.auth.updateUser>>;
type ResetPasswordResult = Awaited<ReturnType<typeof supabase.auth.resetPasswordForEmail>>;

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn().mockReturnValue(false),
  },
}));

vi.mock('../lib/push-notifications', () => ({
  unregisterFromBackend: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/api', () => ({
  api: {
    patch: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../lib/widget-bridge', () => ({
  syncWidgetSession: vi.fn().mockResolvedValue(undefined),
  clearWidgetSession: vi.fn().mockResolvedValue(undefined),
}));

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, isLoading: true });
  });

  it('should have correct initial state', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isLoading).toBe(true);
  });

  it('should set user', () => {
    const user = { id: '1', email: 'a@b.com', name: 'Test', avatarEmoji: '😊' };
    useAuthStore.getState().setUser(user);

    expect(useAuthStore.getState().user).toEqual(user);
  });

  it('should set loading', () => {
    useAuthStore.getState().setLoading(false);

    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  describe('initialize', () => {
    it('should set user from session', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: {
          session: {
            user: {
              id: 'user-1',
              email: 'test@test.com',
              user_metadata: { name: 'Test User', avatarEmoji: '🎉' },
            },
          },
        },
        error: null,
      } as unknown as GetSessionResult);

      await useAuthStore.getState().initialize();

      const state = useAuthStore.getState();
      expect(state.user).toEqual({
        id: 'user-1',
        email: 'test@test.com',
        name: 'Test User',
        avatarEmoji: '🎉',
      });
      expect(state.isLoading).toBe(false);
    });

    it('should set user null when no session', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      });

      await useAuthStore.getState().initialize();

      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });

  describe('signIn', () => {
    it('should call supabase signInWithPassword', async () => {
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: {},
        error: null,
      } as unknown as SignInResult);

      await useAuthStore.getState().signIn('test@test.com', 'pass', 'captcha');

      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@test.com',
        password: 'pass',
        options: { captchaToken: 'captcha' },
      });
    });

    it('should throw on error', async () => {
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: {},
        error: { message: 'Invalid credentials' },
      } as unknown as SignInResult);

      await expect(
        useAuthStore.getState().signIn('bad@test.com', 'wrong', 'captcha'),
      ).rejects.toBeDefined();
    });
  });

  describe('signOut', () => {
    it('should clear user and call supabase signOut', async () => {
      useAuthStore.setState({
        user: { id: '1', email: 'a@b.com', name: 'Test', avatarEmoji: '😊' },
      });
      vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null });

      await useAuthStore.getState().signOut();

      expect(useAuthStore.getState().user).toBeNull();
      expect(supabase.auth.signOut).toHaveBeenCalled();
    });

    it('should clear the widget session before calling supabase signOut', async () => {
      useAuthStore.setState({
        user: { id: '1', email: 'a@b.com', name: 'Test', avatarEmoji: '😊' },
      });
      vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null });
      const callOrder: string[] = [];
      vi.mocked(clearWidgetSession).mockImplementationOnce(async () => {
        callOrder.push('clearWidgetSession');
      });
      vi.mocked(supabase.auth.signOut).mockImplementationOnce(async () => {
        callOrder.push('supabase.auth.signOut');
        return { error: null };
      });

      await useAuthStore.getState().signOut();

      expect(clearWidgetSession).toHaveBeenCalled();
      expect(callOrder).toEqual(['clearWidgetSession', 'supabase.auth.signOut']);
    });

    it('drops a parked invite destination so the next user is not sent to it', async () => {
      vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null });
      savePendingRedirect('/join/12345678');

      await useAuthStore.getState().signOut();

      expect(takePendingRedirect()).toBeNull();
    });
  });

  describe('resetPassword', () => {
    it('uses the public web url as the redirect base on native platforms', async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
      vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValue({
        data: {},
        error: null,
      } as unknown as ResetPasswordResult);

      await useAuthStore.getState().resetPassword('test@test.com', 'captcha');

      expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith('test@test.com', {
        redirectTo: 'https://quedamos.alvarotc.com/reset-password',
        captchaToken: 'captcha',
      });
    });

    it('uses window.location.origin as the redirect base on web', async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
      vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValue({
        data: {},
        error: null,
      } as unknown as ResetPasswordResult);

      await useAuthStore.getState().resetPassword('test@test.com', 'captcha');

      expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith('test@test.com', {
        redirectTo: `${window.location.origin}/reset-password`,
        captchaToken: 'captcha',
      });
    });
  });

  describe('updateName', () => {
    it('should update name in store after supabase update', async () => {
      useAuthStore.setState({
        user: { id: '1', email: 'a@b.com', name: 'Old', avatarEmoji: '😊' },
      });
      vi.mocked(supabase.auth.updateUser).mockResolvedValue({
        data: {},
        error: null,
      } as unknown as UpdateUserResult);

      await useAuthStore.getState().updateName('New Name');

      expect(useAuthStore.getState().user?.name).toBe('New Name');
    });
  });

  describe('updateTimeSlots', () => {
    it('should update timeSlots in store after supabase update', async () => {
      useAuthStore.setState({
        user: { id: '1', email: 'a@b.com', name: 'Test', avatarEmoji: '😊' },
      });
      vi.mocked(supabase.auth.updateUser).mockResolvedValue({
        data: {},
        error: null,
      } as unknown as UpdateUserResult);

      const slots = {
        morningStart: '07:00',
        morningEnd: '12:00',
        afternoonStart: '13:00',
        afternoonEnd: '19:00',
        nightStart: '20:00',
        nightEnd: '00:00',
      };
      await useAuthStore.getState().updateTimeSlots(slots);

      expect(supabase.auth.updateUser).toHaveBeenCalledWith({ data: { timeSlots: slots } });
      expect(useAuthStore.getState().user?.timeSlots).toEqual(slots);
    });

    it('should throw on supabase error', async () => {
      useAuthStore.setState({
        user: { id: '1', email: 'a@b.com', name: 'Test', avatarEmoji: '😊' },
      });
      vi.mocked(supabase.auth.updateUser).mockResolvedValue({
        data: {},
        error: { message: 'Server error' },
      } as unknown as UpdateUserResult);

      await expect(
        useAuthStore.getState().updateTimeSlots({
          morningStart: '08:00',
          morningEnd: '14:00',
          afternoonStart: '14:00',
          afternoonEnd: '20:00',
          nightStart: '20:00',
          nightEnd: '00:00',
        }),
      ).rejects.toBeDefined();
    });

    it('should throw on invalid time slots without calling supabase', async () => {
      useAuthStore.setState({
        user: { id: '1', email: 'a@b.com', name: 'Test', avatarEmoji: '😊' },
      });
      const spy = vi.mocked(supabase.auth.updateUser).mockClear();

      await expect(
        useAuthStore.getState().updateTimeSlots({
          morningStart: '14:00',
          morningEnd: '08:00',
          afternoonStart: '14:00',
          afternoonEnd: '20:00',
          nightStart: '20:00',
          nightEnd: '00:00',
        }),
      ).rejects.toThrow('Invalid time slots');

      expect(spy).not.toHaveBeenCalled();
    });
  });

  it('keeps the same user object reference across repeated auth events', async () => {
    let captured: ((event: string, session: unknown) => void) | null = null;
    vi.mocked(supabase.auth.onAuthStateChange).mockImplementationOnce((cb) => {
      captured = cb as never;
      return { data: { subscription: { unsubscribe: vi.fn() } } } as never;
    });
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    } as never);

    await useAuthStore.getState().initialize();

    const session = {
      user: {
        id: 'user-1',
        email: 'a@b.com',
        user_metadata: { name: 'A', avatarEmoji: '😊' },
      },
    };
    captured!('TOKEN_REFRESHED', session);
    const first = useAuthStore.getState().user;
    captured!('TOKEN_REFRESHED', session);
    const second = useAuthStore.getState().user;

    expect(first).not.toBeNull();
    expect(Object.is(first, second)).toBe(true);
  });

  describe('initialize with timeSlots', () => {
    it('should read valid timeSlots from user_metadata', async () => {
      const slots = {
        morningStart: '09:00',
        morningEnd: '13:00',
        afternoonStart: '14:00',
        afternoonEnd: '19:00',
        nightStart: '20:00',
        nightEnd: '23:00',
      };
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: {
          session: {
            user: {
              id: 'user-1',
              email: 'test@test.com',
              user_metadata: { name: 'Test', avatarEmoji: '😊', timeSlots: slots },
            },
          },
        },
        error: null,
      } as unknown as GetSessionResult);

      await useAuthStore.getState().initialize();

      expect(useAuthStore.getState().user?.timeSlots).toEqual(slots);
    });

    it('should set timeSlots to undefined for corrupted metadata', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: {
          session: {
            user: {
              id: 'user-1',
              email: 'test@test.com',
              user_metadata: {
                name: 'Test',
                avatarEmoji: '😊',
                timeSlots: { morningStart: 'bad' },
              },
            },
          },
        },
        error: null,
      } as unknown as GetSessionResult);

      await useAuthStore.getState().initialize();

      expect(useAuthStore.getState().user?.timeSlots).toBeUndefined();
    });
  });

  describe('widget bridge integration', () => {
    it('initialize with a session syncs the widget session once', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: {
          session: {
            user: {
              id: 'user-1',
              email: 'test@test.com',
              user_metadata: { name: 'Test User', avatarEmoji: '🎉' },
            },
          },
        },
        error: null,
      } as unknown as GetSessionResult);

      await useAuthStore.getState().initialize();

      expect(syncWidgetSession).toHaveBeenCalledTimes(1);
    });

    it('initialize without a session does not sync the widget session', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      } as unknown as GetSessionResult);

      await useAuthStore.getState().initialize();

      expect(syncWidgetSession).not.toHaveBeenCalled();
    });

    it('onAuthStateChange with a session syncs the widget session (login / TOKEN_REFRESHED)', async () => {
      let captured: ((event: string, session: unknown) => void) | null = null;
      vi.mocked(supabase.auth.onAuthStateChange).mockImplementationOnce((cb) => {
        captured = cb as never;
        return { data: { subscription: { unsubscribe: vi.fn() } } } as never;
      });
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      } as unknown as GetSessionResult);

      await useAuthStore.getState().initialize();
      expect(syncWidgetSession).not.toHaveBeenCalled();

      captured!('SIGNED_IN', {
        user: {
          id: 'user-1',
          email: 'a@b.com',
          user_metadata: { name: 'A', avatarEmoji: '😊' },
        },
      });

      expect(syncWidgetSession).toHaveBeenCalledTimes(1);
    });

    it('a rejected syncWidgetSession does not break initialize', async () => {
      const rejected = Promise.reject(new Error('boom'));
      rejected.catch(() => {}); // avoid unhandled-rejection noise for this fire-and-forget call
      vi.mocked(syncWidgetSession).mockReturnValueOnce(rejected);
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: {
          session: {
            user: {
              id: 'user-1',
              email: 'test@test.com',
              user_metadata: { name: 'Test User', avatarEmoji: '🎉' },
            },
          },
        },
        error: null,
      } as unknown as GetSessionResult);

      await expect(useAuthStore.getState().initialize()).resolves.toBeUndefined();

      const state = useAuthStore.getState();
      expect(state.user).toEqual({
        id: 'user-1',
        email: 'test@test.com',
        name: 'Test User',
        avatarEmoji: '🎉',
      });
      expect(state.isLoading).toBe(false);
    });
  });

  describe('updateEmail', () => {
    it('uses the public web url as the confirmation redirect base on native platforms', async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
      vi.mocked(supabase.auth.updateUser).mockResolvedValue({
        data: { user: null },
        error: null,
      } as unknown as UpdateUserResult);

      await useAuthStore.getState().updateEmail('nuevo@test.com');

      expect(supabase.auth.updateUser).toHaveBeenCalledWith(
        { email: 'nuevo@test.com' },
        { emailRedirectTo: 'https://quedamos.alvarotc.com/tabs/profile' },
      );
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    });
  });
});
