import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { unregisterFromBackend } from '../lib/push-notifications';
import {
  sanitizeTimeSlots,
  validateTimeSlots,
  type TimeSlotPreferences,
} from '../lib/time-slot-utils';
import i18n from '../i18n';

let authSubscription: { unsubscribe: () => void } | null = null;

interface User {
  id: string;
  email: string;
  name: string;
  avatarEmoji: string;
  timeSlots?: TimeSlotPreferences;
}

export function mapSessionUser(sessionUser: {
  id: string;
  email?: string | null;
  user_metadata?: { name?: string; avatarEmoji?: string; timeSlots?: unknown };
}): User {
  return {
    id: sessionUser.id,
    email: sessionUser.email ?? '',
    name: sessionUser.user_metadata?.name ?? i18n.t('auth.defaultName'),
    avatarEmoji: sessionUser.user_metadata?.avatarEmoji ?? '😊',
    timeSlots: sanitizeTimeSlots(sessionUser.user_metadata?.timeSlots),
  };
}

export function usersEqual(a: User | null, b: User | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.id === b.id &&
    a.email === b.email &&
    a.name === b.name &&
    a.avatarEmoji === b.avatarEmoji &&
    JSON.stringify(a.timeSlots ?? null) === JSON.stringify(b.timeSlots ?? null)
  );
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
  updateTimeSlots: (timeSlots: TimeSlotPreferences) => Promise<void>;
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
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.user) {
      set({ user: mapSessionUser(session.user), isLoading: false });
    } else {
      set({ user: null, isLoading: false });
    }

    if (authSubscription) {
      authSubscription.unsubscribe();
    }
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const next = session?.user ? mapSessionUser(session.user) : null;
      set((state) => (usersEqual(state.user, next) ? state : { user: next }));
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
    await api.patch('/auth/me', { name });
    set((state) => ({
      user: state.user ? { ...state.user, name } : null,
    }));
  },

  updateEmail: async (email) => {
    const { error } = await supabase.auth.updateUser(
      { email },
      { emailRedirectTo: `${window.location.origin}/tabs/profile` },
    );
    if (error) throw error;
  },

  updateTimeSlots: async (timeSlots) => {
    const validationError = validateTimeSlots(timeSlots);
    if (validationError) throw new Error(`Invalid time slots: ${validationError}`);
    const { error } = await supabase.auth.updateUser({ data: { timeSlots } });
    if (error) throw error;
    set((state) => ({
      user: state.user ? { ...state.user, timeSlots } : null,
    }));
  },
}));
