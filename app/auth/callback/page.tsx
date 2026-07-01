"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function AuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Supabase email verification is handled automatically
    // Just redirect to home page
    const timer = setTimeout(() => {
      router.push("/");
    }, 1000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex flex-col items-center justify-center px-6">
      <div className="flex flex-col items-center gap-4">
        <div className="text-5xl mb-4">✅</div>
        <h1 className="text-2xl font-bold text-gray-900">Email Verified!</h1>
        <p className="text-gray-600 text-center">
          Your account has been activated.
        </p>
        <p className="text-sm text-gray-500 mt-4">
          Redirecting to app...
        </p>
      </div>
    </div>
  );
}
