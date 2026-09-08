import { create } from 'zustand';
import { Capacitor } from '@capacitor/core';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { unregisterFromBackend } from '../lib/push-notifications';
import { syncWidgetSession, clearWidgetSession } from '../lib/widget-bridge';
import {
  sanitizeTimeSlots,
  validateTimeSlots,
  type TimeSlotPreferences,
} from '../lib/time-slot-utils';
import { PUBLIC_WEB_URL, EMAIL_CONFIRMED_PATH } from '../lib/constants';
import { clearPendingRedirect } from '../lib/pending-redirect';
import i18n from '../i18n';

let authSubscription: { unsubscribe: () => void } | null = null;

/**
 * Where Supabase must send someone back after they click a link in an email.
 *
 * Capacitor's WebView reports `https://localhost` as its origin, which isn't in
 * Supabase's allowlist, so native builds point at the public site and let Android's
 * verified App Links reopen the app on that URL.
 */
function authRedirectBase(): string {
  return Capacitor.isNativePlatform() ? PUBLIC_WEB_URL : window.location.origin;
}

interface User {
  id: string;
  email: string;
  name: string;
  avatarEmoji: string;
  timeSlots?: TimeSlotPreferences;
}

function mapSessionUser(sessionUser: {
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

function usersEqual(a: User | null, b: User | null): boolean {
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
  deleteAccount: () => Promise<void>;
  initialize: () => Promise<void>;
  resetPassword: (email: string, captchaToken: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  updateName: (name: string) => Promise<void>;
  updateEmail: (email: string) => Promise<void>;
  updateTimeSlots: (timeSlots: TimeSlotPreferences) => Promise<void>;
  resendConfirmation: (email: string, captchaToken: string) => Promise<void>;
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
    // Without an explicit destination the confirmation link lands wherever the
    // project's Site URL points, which on Android means the browser: another origin,
    // another localStorage, and the parked invite lost. /auth/confirmed is a route of
    // this app, and on Android the verified App Link opens it inside the app.
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        captchaToken,
        emailRedirectTo: `${authRedirectBase()}${EMAIL_CONFIRMED_PATH}`,
      },
    });
    if (error) throw error;
  },

  signOut: async () => {
    await unregisterFromBackend().catch(() => {});
    await clearWidgetSession();
    // An invite parked before signing in belongs to whoever was going there: it
    // must not fire for the next person to log in on this device.
    clearPendingRedirect();
    await supabase.auth.signOut();
    set({ user: null });
  },

  deleteAccount: async () => {
    // Once the account is gone no request may reach the API with this session (the
    // guard would recreate the user from the still-valid JWT), so the device forgets
    // its push and widget tokens first. Their server rows fall with the user anyway.
    await unregisterFromBackend().catch(() => {});
    await clearWidgetSession();
    clearPendingRedirect();
    try {
      await api.delete('/auth/me');
    } catch (error) {
      // Still signed in: put the widget back now, push registers again on next launch.
      void syncWidgetSession();
      throw error;
    }
    // The auth user no longer exists, so a global sign-out would call Supabase with
    // a dead token: only the local session is dropped.
    await supabase.auth.signOut({ scope: 'local' });
    set({ user: null });
  },

  initialize: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.user) {
      set({ user: mapSessionUser(session.user), isLoading: false });
      void syncWidgetSession();
    } else {
      set({ user: null, isLoading: false });
    }

    if (authSubscription) {
      authSubscription.unsubscribe();
    }
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        void syncWidgetSession();
      }
      const next = session?.user ? mapSessionUser(session.user) : null;
      set((state) => (usersEqual(state.user, next) ? state : { user: next }));
    });
    authSubscription = data.subscription;
  },

  resetPassword: async (email, captchaToken) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${authRedirectBase()}/reset-password`,
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
      { emailRedirectTo: `${authRedirectBase()}/tabs/profile` },
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

  // The first confirmation email gets lost often enough (spam folder, a typo caught
  // too late, an app closed before opening it) that a signed-up account with no way
  // to ask for another one is a dead end: signing up again answers "user already
  // registered". Same destination as the original mail, captcha included because the
  // endpoint is as unauthenticated as the sign-up itself.
  resendConfirmation: async (email, captchaToken) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${authRedirectBase()}${EMAIL_CONFIRMED_PATH}`,
        captchaToken,
      },
    });
    if (error) throw error;
  },
}));
