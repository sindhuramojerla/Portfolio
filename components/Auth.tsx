"use client";

import { useState, useEffect } from "react";
import { Session } from "@supabase/supabase-js";
import { login, signup, logout, onAuthStateChange } from "@/lib/auth";
import { useAppStore } from "@/lib/store";
import { Eye, EyeOff, Loader2 } from "lucide-react";

interface AuthProps {
  onAuthSuccess: (session: Session) => void;
}

export default function Auth({ onAuthSuccess }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Check if user is already logged in
    const unsubscribe = onAuthStateChange((session) => {
      if (session) {
        onAuthSuccess(session);
      }
    });
    return unsubscribe;
  }, [onAuthSuccess]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (isLogin) {
        const result = await login(email, password);
        if (!result.success) {
          setError(result.error || "Login failed");
        }
      } else {
        const result = await signup(email, password);
        if (!result.success) {
          setError(result.error || "Signup failed");
        } else {
          setError(""); // Clear error on successful signup
          setEmail("");
          setPassword("");
          setIsLogin(true); // Switch to login after successful signup
        }
      }
    } catch (e) {
      setError("An error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-rose-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">🍽️ HomePlate</h1>
          <p className="text-gray-600">Daily food log for your household</p>
        </div>

        {/* Auth Card */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:border-orange-400 text-gray-900 bg-white"
                placeholder="your@email.com"
                required
                disabled={loading}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 pr-12 outline-none focus:border-orange-400 text-gray-900 bg-white"
                  placeholder="••••••••"
                  required
                  minLength={6}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  disabled={loading}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {!isLogin && (
                <p className="text-xs text-gray-500 mt-1">Minimum 6 characters</p>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Success Message */}
            {!isLogin && !error && email && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700">
                ✓ Check your email to confirm your account, then log in
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full py-3 rounded-xl bg-orange-500 text-white font-semibold flex items-center justify-center gap-2 hover:bg-orange-600 disabled:opacity-50 transition-colors"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isLogin ? "Log in" : "Create account"}
            </button>

            {/* Toggle Auth Mode */}
            <div className="text-center text-sm text-gray-600">
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError("");
                  setPassword("");
                }}
                className="text-orange-500 hover:text-orange-600 font-medium"
                disabled={loading}
              >
                {isLogin ? "Sign up" : "Log in"}
              </button>
            </div>
          </form>
        </div>

        {/* Info */}
        <p className="text-center text-xs text-gray-500 mt-6">
          🔒 Your data is encrypted and secure
        </p>
      </div>
    </div>
  );
}
