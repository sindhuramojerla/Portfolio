"use client";

import { useState } from "react";
import { Member, NutritionGoals } from "@/lib/types";
import { useAppStore } from "@/lib/store";
import { deriveInitials, AVATAR_COLORS } from "@/lib/foods";
import { X, Check, ChevronDown, ChevronUp, Copy, RefreshCw, Loader2 } from "lucide-react";

interface Props {
  onClose: () => void;
}

export default function SettingsSheet({ onClose }: Props) {
  const { household, saveHousehold, pullLatest, sync } = useAppStore();

  const [householdName, setHouseholdName] = useState(household.householdName);
  const [members, setMembers] = useState<Member[]>(
    household.members.map((m) => ({ ...m, goals: { ...m.goals } }))
  );
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  function updateMemberField(idx: number, field: keyof Member, value: string) {
    setMembers((prev) => {
      const next = [...prev];
      if (field === "name") {
        next[idx] = { ...next[idx], name: value, initials: deriveInitials(value || `M${idx + 1}`) };
      } else if (field === "initials") {
        next[idx] = { ...next[idx], initials: value.toUpperCase().slice(0, 2) };
      }
      return next;
    });
  }

  function updateGoal(idx: number, key: keyof NutritionGoals, raw: string) {
    const val = parseInt(raw, 10);
    if (isNaN(val) || val < 0) return;
    setMembers((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], goals: { ...next[idx].goals, [key]: val } };
      return next;
    });
  }

  function setColor(idx: number, color: string) {
    setMembers((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], avatarColor: color };
      return next;
    });
  }

  async function handleSave() {
    await saveHousehold({ ...household, householdName: householdName.trim() || household.householdName, members });
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 800);
  }

  function copyCode() {
    navigator.clipboard.writeText(household.joinCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSync() {
    await pullLatest();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end">
      <div className="bg-white w-full rounded-t-3xl max-h-[92vh] flex flex-col max-w-lg mx-auto">
        {/* Handle + header */}
        <div className="px-6 pt-4 pb-3 border-b border-gray-100 flex-shrink-0">
          <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Settings</h2>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">

          {/* Join code card */}
          {household.joinCode && (
            <div className="bg-orange-50 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-orange-600 uppercase tracking-wide mb-1">
                    Household join code
                  </div>
                  <div className="text-3xl font-bold tracking-widest text-orange-700">
                    {household.joinCode}
                  </div>
                </div>
                <button
                  onClick={copyCode}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-orange-100 text-orange-700 text-sm font-medium"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <p className="text-xs text-orange-500">
                Share this code with the other phone to sync your household data.
              </p>
            </div>
          )}

          {/* Sync status */}
          <div className="flex items-center justify-between bg-gray-50 rounded-2xl px-4 py-3">
            <div>
              <div className="text-sm font-medium text-gray-700">Sync with cloud</div>
              <div className="text-xs text-gray-400 mt-0.5">
                {sync.syncError
                  ? `Error: ${sync.syncError}`
                  : sync.lastSyncedAt
                  ? `Last synced ${new Date(sync.lastSyncedAt).toLocaleTimeString()}`
                  : "Not synced yet"}
              </div>
            </div>
            <button
              onClick={handleSync}
              disabled={sync.syncing}
              className="p-2 rounded-xl bg-white border border-gray-200 text-gray-600 disabled:opacity-50"
            >
              {sync.syncing
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <RefreshCw className="w-4 h-4" />}
            </button>
          </div>

          {/* Household name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Household name</label>
            <input
              className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-base outline-none focus:border-orange-400 bg-white"
              value={householdName}
              onChange={(e) => setHouseholdName(e.target.value)}
            />
          </div>

          {/* Member cards */}
          {members.map((m, idx) => {
            const open = expandedIdx === idx;
            return (
              <div key={m.id} className="border border-gray-100 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setExpandedIdx(open ? null : idx)}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-white text-left"
                >
                  <div className={`w-9 h-9 rounded-full ${m.avatarColor} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
                    {m.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-800 truncate">{m.name}</div>
                    <div className="text-xs text-gray-400">{m.goals.calories} kcal / day</div>
                  </div>
                  {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>

                {open && (
                  <div className="px-4 pb-4 space-y-4 border-t border-gray-50">
                    <div className="mt-3">
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Name</label>
                      <input
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-400"
                        value={m.name}
                        onChange={(e) => updateMemberField(idx, "name", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">
                        Initials <span className="font-normal text-gray-400">(shown on avatar)</span>
                      </label>
                      <input
                        className="w-20 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-400 uppercase"
                        value={m.initials}
                        maxLength={2}
                        onChange={(e) => updateMemberField(idx, "initials", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-2">Colour</label>
                      <div className="flex gap-2">
                        {AVATAR_COLORS.map((color) => (
                          <button
                            key={color}
                            onClick={() => setColor(idx, color)}
                            className={`w-8 h-8 rounded-full ${color} flex items-center justify-center transition-transform ${m.avatarColor === color ? "ring-2 ring-offset-2 ring-gray-400 scale-110" : ""}`}
                          >
                            {m.avatarColor === color && <Check className="w-4 h-4 text-white" />}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-2">Daily targets</label>
                      <div className="space-y-2">
                        {(
                          [
                            { key: "calories", label: "Calories", unit: "kcal" },
                            { key: "protein",  label: "Protein",  unit: "g"    },
                            { key: "carbs",    label: "Carbs",    unit: "g"    },
                            { key: "fibre",    label: "Fibre",    unit: "g"    },
                            { key: "fat",      label: "Fat",      unit: "g"    },
                          ] as { key: keyof NutritionGoals; label: string; unit: string }[]
                        ).map(({ key, label, unit }) => (
                          <div key={key} className="flex items-center gap-3">
                            <span className="text-sm text-gray-600 w-20 flex-shrink-0">{label}</span>
                            <div className="relative flex-1">
                              <input
                                type="number" min="0"
                                className="w-full border border-gray-200 rounded-xl px-3 py-2 pr-10 text-sm outline-none focus:border-orange-400"
                                value={m.goals[key]}
                                onChange={(e) => updateGoal(idx, key, e.target.value)}
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{unit}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Save */}
        <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0">
          <button
            onClick={handleSave}
            className={`w-full py-4 rounded-2xl font-semibold text-base transition-colors flex items-center justify-center gap-2 ${
              saved ? "bg-green-500 text-white" : "bg-gray-900 text-white active:bg-gray-800"
            }`}
          >
            {saved ? <><Check className="w-5 h-5" /> Saved!</> : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
