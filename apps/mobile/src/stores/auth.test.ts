import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuthStore } from './auth';
import { supabase } from '../lib/supabase';

vi.mock('../lib/push-notifications', () => ({
  unregisterFromBackend: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/api', () => ({
  api: {
    patch: vi.fn().mockResolvedValue(undefined),
  },
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
          } as any,
        },
        error: null,
      });

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
        data: {} as any,
        error: null,
      });

      await useAuthStore.getState().signIn('test@test.com', 'pass', 'captcha');

      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@test.com',
        password: 'pass',
        options: { captchaToken: 'captcha' },
      });
    });

    it('should throw on error', async () => {
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: {} as any,
        error: { message: 'Invalid credentials' } as any,
      });

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
  });

  describe('updateName', () => {
    it('should update name in store after supabase update', async () => {
      useAuthStore.setState({
        user: { id: '1', email: 'a@b.com', name: 'Old', avatarEmoji: '😊' },
      });
      vi.mocked(supabase.auth.updateUser).mockResolvedValue({
        data: {} as any,
        error: null,
      });

      await useAuthStore.getState().updateName('New Name');

      expect(useAuthStore.getState().user?.name).toBe('New Name');
    });
  });
});
