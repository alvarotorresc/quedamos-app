import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { unregisterFromBackend } from '../lib/push-notifications';
import i18n from '../i18n';

let authSubscription: { unsubscribe: () => void } | null = null;

interface User {
  id: string;
  email: string;
  name: string;
  avatarEmoji: string;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  signIn: (email: string, password: string, captchaToken: string) => Promise<void>;
  signUp: (email: string, password: string, name: string, captchaToken: string) => Promise<void>;
  signOut: () => Promise<void>;
  initialize: () => Promise<void>;
  resetPassword: (email: string, captchaToken: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  updateName: (name: string) => Promise<void>;
  updateEmail: (email: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,

  setUser: (user) => set({ user }),
  setLoading: (isLoading) => set({ isLoading }),

  signIn: async (email, password, captchaToken) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: { captchaToken },
    });
    if (error) throw error;
  },

  signUp: async (email, password, name, captchaToken) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        captchaToken,
      },
    });
    if (error) throw error;
  },

  signOut: async () => {
    await unregisterFromBackend().catch(() => {});
    await supabase.auth.signOut();
    set({ user: null });
  },

  initialize: async () => {
    const { data: { session } } = await supabase.auth.getSession();

    if (session?.user) {
      set({
        user: {
          id: session.user.id,
          email: session.user.email ?? '',
          name: session.user.user_metadata?.name ?? i18n.t('auth.defaultName'),
          avatarEmoji: session.user.user_metadata?.avatarEmoji ?? '😊',
        },
        isLoading: false,
      });
    } else {
      set({ user: null, isLoading: false });
    }

    if (authSubscription) {
      authSubscription.unsubscribe();
    }
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        set({
          user: {
            id: session.user.id,
            email: session.user.email ?? '',
            name: session.user.user_metadata?.name ?? i18n.t('auth.defaultName'),
            avatarEmoji: session.user.user_metadata?.avatarEmoji ?? '😊',
          },
        });
      } else {
        set({ user: null });
      }
    });
    authSubscription = data.subscription;
  },

  resetPassword: async (email, captchaToken) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
      captchaToken,
    });
    if (error) throw error;
  },

  updatePassword: async (password) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  },

  updateName: async (name) => {
    const { error } = await supabase.auth.updateUser({ data: { name } });
    if (error) throw error;
    set((state) => ({
      user: state.user ? { ...state.user, name } : null,
    }));
  },

  updateEmail: async (email) => {
    const { error } = await supabase.auth.updateUser({ email });
    if (error) throw error;
  },
}));
