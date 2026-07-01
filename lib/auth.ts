"use client";

import { supabase } from "./supabase";
import { AuthError, Session } from "@supabase/supabase-js";

/**
 * Signup: Create a new account
 * Returns { success, error } to avoid exposing user data
 */
export async function signup(
  email: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  if (!email || !password) {
    return { success: false, error: "Email and password required" };
  }

  try {
    const { error } = await supabase.auth.signUp({
      email: email.toLowerCase().trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      // Don't reveal whether email exists (prevent enumeration)
      if (error.message.includes("already registered")) {
        return { success: false, error: "Account with this email already exists" };
      }
      return { success: false, error: "Signup failed. Please try again." };
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: "Signup failed" };
  }
}

/**
 * Login: Authenticate with email/password
 */
export async function login(
  email: string,
  password: string
): Promise<{ success: boolean; session?: Session; error?: string }> {
  if (!email || !password) {
    return { success: false, error: "Email and password required" };
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password,
    });

    if (error) {
      // Don't reveal whether email exists or password is wrong
      return { success: false, error: "Invalid email or password" };
    }

    if (!data.session) {
      return { success: false, error: "Login failed" };
    }

    return { success: true, session: data.session };
  } catch (e) {
    return { success: false, error: "Login failed" };
  }
}

/**
 * Logout: Clear session
 */
export async function logout(): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: "Logout failed" };
  }
}

/**
 * Get current session
 */
export async function getCurrentSession(): Promise<Session | null> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session;
  } catch {
    return null;
  }
}

/**
 * Subscribe to auth state changes
 */
export function onAuthStateChange(
  callback: (session: Session | null) => void
): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });

  return () => {
    data?.subscription?.unsubscribe();
  };
}

/**
 * Password reset request
 */
export async function requestPasswordReset(
  email: string
): Promise<{ success: boolean; error?: string }> {
  if (!email) {
    return { success: false, error: "Email required" };
  }

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(
      email.toLowerCase().trim(),
      {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      }
    );

    if (error) {
      return { success: false, error: "Password reset request failed" };
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: "Password reset request failed" };
  }
}

/**
 * Update password with token from reset email
 */
export async function updatePasswordWithToken(
  token: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  if (!token || !newPassword) {
    return { success: false, error: "Token and new password required" };
  }

  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      return { success: false, error: "Password update failed" };
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: "Password update failed" };
  }
}
