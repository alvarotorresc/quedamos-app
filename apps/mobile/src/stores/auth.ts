import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import i18n from '../i18n';

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

    supabase.auth.onAuthStateChange((_event, session) => {
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
}));
