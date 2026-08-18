import { create } from 'zustand';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../utils/supabase';
import { useAppStore } from './useAppStore';
import { AccountType } from '../types';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  // True from the moment the user lands back on the app via a password-reset
  // email link until they've set a new password — App.tsx shows the
  // "set new password" screen instead of the normal signed-in app while this
  // is true, even though Supabase has already established a session for them.
  passwordRecovery: boolean;
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, accountType: AccountType) => Promise<void>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  session: null,
  loading: true,
  error: null,
  passwordRecovery: false,

  initialize: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    set({ user: session?.user ?? null, session, loading: false });

    supabase.auth.onAuthStateChange((event, session) => {
      set({ user: session?.user ?? null, session });
      if (event === 'PASSWORD_RECOVERY') set({ passwordRecovery: true });
    });
  },

  signIn: async (email, password) => {
    set({ error: null });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) set({ error: error.message });
  },

  signUp: async (email, password, accountType) => {
    set({ error: null });
    // Stored on auth.users.raw_user_meta_data immediately, even before email
    // confirmation — read back by useAppStore.initialize() on first load to
    // seed the new user's settings row with the right accountType.
    const { error } = await supabase.auth.signUp({ email, password, options: { data: { accountType } } });
    if (error) set({ error: error.message });
  },

  signOut: async () => {
    await supabase.auth.signOut();
    useAppStore.getState().reset();
    set({ user: null, session: null });
  },

  // Never look up whether the email exists, and never reveal the password
  // itself anywhere — Supabase emails the user a one-time link that lets
  // them set a new password themselves (handled by updatePassword below).
  sendPasswordReset: async (email) => {
    set({ error: null });
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (error) set({ error: error.message });
  },

  updatePassword: async (newPassword) => {
    set({ error: null });
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      set({ error: error.message });
      return;
    }
    set({ passwordRecovery: false });
  },

  clearError: () => set({ error: null }),
}));
