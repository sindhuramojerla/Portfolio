"use client";

import { useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { RefreshCw } from "lucide-react";

/** Silently re-pulls from Supabase whenever the tab regains focus.
 *  Shows a brief "Syncing…" banner so users know updates arrived. */
export default function SyncBanner() {
  const { pullLatest, sync } = useAppStore();

  // Pull on first mount
  useEffect(() => {
    pullLatest();
  }, []);

  // Pull again whenever the user switches back to this tab / app
  useEffect(() => {
    function onFocus() { pullLatest(); }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [pullLatest]);

  if (!sync.syncing) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-40 flex justify-center pt-safe">
      <div className="mt-16 flex items-center gap-2 bg-gray-900/90 text-white text-xs font-medium px-4 py-2 rounded-full shadow-lg">
        <RefreshCw className="w-3 h-3 animate-spin" />
        Syncing…
      </div>
    </div>
  );
}
