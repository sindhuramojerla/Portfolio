"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import Auth from "@/components/Auth";
import AuthLoading from "@/components/AuthLoading";
import MainApp from "./main";

export default function Home() {
  const { currentUserId, authInitialized, authLoading, initAuth } = useAppStore();
  const [unsubscribe, setUnsubscribe] = useState<(() => void) | null>(null);

  // Initialize auth on mount
  useEffect(() => {
    const cleanup = initAuth();
    setUnsubscribe(() => cleanup);

    return () => {
      // Cleanup auth subscription on unmount
      cleanup();
    };
  }, [initAuth]);

  // Show loading screen while auth is initializing
  if (authLoading || !authInitialized) {
    return <AuthLoading />;
  }

  // Not authenticated: show login/signup
  if (!currentUserId) {
    return <Auth />;
  }

  // Authenticated: show main app (which includes onboarding gate)
  return <MainApp />;
}
