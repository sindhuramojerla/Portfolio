"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { HouseholdConfig } from "@/lib/types";
import { CheckCircle, AlertCircle, Loader2, Home } from "lucide-react";

interface ClaimHouseholdModalProps {
  household: { id: string; config: HouseholdConfig };
  onClaimed: () => void;
}

export default function ClaimHouseholdModal({
  household,
  onClaimed,
}: ClaimHouseholdModalProps) {
  const { claimHousehold } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [claimed, setClaimed] = useState(false);

  const handleClaim = async () => {
    setLoading(true);
    setError("");

    const result = await claimHousehold(household.id);
    if (result.success) {
      setClaimed(true);
      setTimeout(onClaimed, 1500);
    } else {
      setError(result.error || "Failed to claim household");
      setLoading(false);
    }
  };

  if (claimed) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Household Claimed!</h2>
          <p className="text-gray-600 text-sm">
            You can now access <strong>{household.config.householdName}</strong>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
            <Home className="w-5 h-5 text-orange-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Claim Household</h2>
        </div>

        {/* Content */}
        <div className="space-y-4 mb-6">
          <p className="text-gray-600 text-sm">
            We found an existing household data from your previous session:
          </p>

          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-gray-900">
              {household.config.householdName}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {household.config.members.length} member{household.config.members.length !== 1 ? "s" : ""}
            </p>

            {/* Members */}
            <div className="mt-3 space-y-1">
              {household.config.members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-2 text-xs text-gray-700"
                >
                  <div
                    className={`w-2 h-2 rounded-full ${m.avatarColor}`}
                  />
                  {m.name}
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-gray-500">
            By claiming this household, you'll link your account to it and regain access
            to all existing meal logs and data.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 text-sm text-red-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => window.location.href = "/"}
            disabled={loading}
            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-gray-700 font-medium text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            Skip for now
          </button>
          <button
            onClick={handleClaim}
            disabled={loading}
            className="flex-1 px-4 py-3 rounded-xl bg-orange-500 text-white font-medium text-sm hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Claiming...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Claim Household
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
