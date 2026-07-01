"use client";

/**
 * AuthLoading: Show while Supabase is checking the session
 */
export default function AuthLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex flex-col items-center justify-center px-6">
      <div className="flex flex-col items-center gap-4">
        <div className="text-5xl mb-4">🍽️</div>
        <h1 className="text-2xl font-bold text-gray-900">HomePlate</h1>

        {/* Loading spinner */}
        <div className="flex items-center gap-3 mt-8">
          <div className="relative w-8 h-8">
            <div
              className="absolute inset-0 rounded-full border-4 border-orange-200"
            />
            <div
              className="absolute inset-0 rounded-full border-4 border-transparent border-t-orange-500 animate-spin"
            />
          </div>
          <p className="text-sm text-gray-600">Checking session...</p>
        </div>

        <p className="text-xs text-gray-400 mt-8 text-center max-w-xs">
          Restoring your session and household data
        </p>
      </div>
    </div>
  );
}
