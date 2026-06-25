"use client";

import { useState } from "react";
import { HouseholdConfig, Member, NutritionGoals } from "@/lib/types";
import { DEFAULT_GOALS, AVATAR_COLORS, deriveInitials } from "@/lib/foods";
import { useAppStore, generateJoinCode } from "@/lib/store";
import { ChevronRight, ChevronLeft, Check, Users, Plus, Loader2 } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

interface MemberDraft {
  name: string;
  goals: NutritionGoals;
}

type Step = "welcome" | "household" | "member-0" | "member-1" | "goals-0" | "goals-1" | "review";
const CREATE_STEPS: Step[] = ["welcome", "household", "member-0", "member-1", "goals-0", "goals-1", "review"];

export default function Onboarding() {
  const { saveHousehold, joinHousehold, sync } = useAppStore();

  // "create" or "join" path
  const [mode, setMode] = useState<"choose" | "create" | "join">("choose");

  // create-path state
  const [stepIndex, setStepIndex] = useState(0);
  const [householdName, setHouseholdName] = useState("");
  const [members, setMembers] = useState<[MemberDraft, MemberDraft]>([
    { name: "", goals: { ...DEFAULT_GOALS } },
    { name: "", goals: { ...DEFAULT_GOALS } },
  ]);

  // join-path state
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joining, setJoining] = useState(false);

  // ── create path helpers ──────────────────────────────────────────────────

  const step = CREATE_STEPS[stepIndex];
  const progress = ((stepIndex + 1) / CREATE_STEPS.length) * 100;

  function updateMember(idx: 0 | 1, patch: Partial<MemberDraft>) {
    setMembers((prev) => {
      const next: [MemberDraft, MemberDraft] = [...prev] as [MemberDraft, MemberDraft];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  }

  function updateGoal(idx: 0 | 1, key: keyof NutritionGoals, raw: string) {
    const val = parseInt(raw, 10);
    if (isNaN(val) || val < 0) return;
    updateMember(idx, { goals: { ...members[idx].goals, [key]: val } });
  }

  function canAdvance(): boolean {
    if (step === "household") return householdName.trim().length > 0;
    if (step === "member-0") return members[0].name.trim().length > 0;
    if (step === "member-1") return members[1].name.trim().length > 0;
    return true;
  }

  function next() {
    if (!canAdvance()) return;
    if (stepIndex < CREATE_STEPS.length - 1) setStepIndex((i) => i + 1);
  }

  function back() {
    if (stepIndex > 0) setStepIndex((i) => i - 1);
    else setMode("choose");
  }

  async function finish() {
    const builtMembers: Member[] = members.map((m, i) => ({
      id: uuidv4(),
      name: m.name.trim(),
      initials: deriveInitials(m.name.trim()),
      avatarColor: AVATAR_COLORS[i],
      goals: m.goals,
    }));
    const code = generateJoinCode();
    const hid  = uuidv4();
    const config: HouseholdConfig = {
      householdName: householdName.trim(),
      members: builtMembers,
      onboardingComplete: true,
      householdId: hid,
      joinCode: code,
    };
    await saveHousehold(config);
  }

  // ── join path ────────────────────────────────────────────────────────────

  async function handleJoin() {
    if (joinCode.trim().length < 4) return;
    setJoining(true);
    setJoinError("");
    const result = await joinHousehold(joinCode.trim());
    setJoining(false);
    if (!result.success) {
      setJoinError(result.error ?? "Something went wrong.");
    }
    // on success the store sets onboardingComplete → page re-renders
  }

  // ── render ───────────────────────────────────────────────────────────────

  if (mode === "choose") {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <div className="text-5xl mb-4">🍽️</div>
            <h1 className="text-2xl font-bold text-gray-900">HomePlate</h1>
            <p className="text-gray-500 mt-2 text-sm">Daily food log for your household</p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => setMode("create")}
              className="w-full flex items-center gap-4 px-5 py-4 bg-white rounded-2xl border border-gray-100 shadow-sm text-left active:bg-gray-50"
            >
              <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                <Plus className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <div className="font-semibold text-gray-800">Set up a new household</div>
                <div className="text-xs text-gray-400 mt-0.5">Create your profile, get a join code</div>
              </div>
            </button>

            <button
              onClick={() => setMode("join")}
              className="w-full flex items-center gap-4 px-5 py-4 bg-white rounded-2xl border border-gray-100 shadow-sm text-left active:bg-gray-50"
            >
              <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
                <Users className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <div className="font-semibold text-gray-800">Join an existing household</div>
                <div className="text-xs text-gray-400 mt-0.5">Enter the 6-character join code</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === "join") {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col px-6 py-10">
        <button onClick={() => setMode("choose")} className="flex items-center gap-1 text-sm text-gray-400 mb-8 -ml-1 w-fit">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>

        <div className="mb-8">
          <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center mb-4">
            <Users className="w-6 h-6 text-violet-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">Join your household</h2>
          <p className="text-gray-500 text-sm">
            Ask the person who set up the household for the 6-character join code.
          </p>
        </div>

        <label className="block text-sm font-semibold text-gray-700 mb-2">Join code</label>
        <input
          autoFocus
          className="w-full border border-gray-200 rounded-2xl px-4 py-4 text-2xl font-bold tracking-widest uppercase text-center outline-none focus:border-violet-400 bg-white"
          placeholder="HP····"
          value={joinCode}
          maxLength={8}
          onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setJoinError(""); }}
          onKeyDown={(e) => e.key === "Enter" && handleJoin()}
        />
        {joinError && (
          <p className="text-sm text-red-500 mt-2 text-center">{joinError}</p>
        )}

        <div className="mt-auto pt-8">
          <button
            onClick={handleJoin}
            disabled={joinCode.trim().length < 4 || joining}
            className="w-full py-4 rounded-2xl bg-violet-600 text-white font-semibold text-base flex items-center justify-center gap-2 disabled:opacity-40"
          >
            {joining ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Joining…</>
            ) : (
              <>Join household <ChevronRight className="w-5 h-5" /></>
            )}
          </button>
        </div>
      </div>
    );
  }

  // ── CREATE PATH ──────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="h-1 bg-gray-200">
        <div className="h-1 bg-orange-400 transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>

      <div className="flex-1 flex flex-col max-w-lg mx-auto w-full px-6 py-8">
        {stepIndex > 0 || step === "welcome" ? (
          <button onClick={back} className="flex items-center gap-1 text-sm text-gray-400 mb-6 -ml-1 w-fit">
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
        ) : null}

        {/* Welcome */}
        {step === "welcome" && (
          <div className="flex-1 flex flex-col">
            <div className="mb-8">
              <div className="text-3xl mb-3">🏠</div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Set up your household</h1>
              <p className="text-gray-500">
                We'll create a join code you can share so both phones stay in sync.
              </p>
            </div>
            <div className="bg-orange-50 rounded-2xl p-4 text-sm text-orange-700 space-y-2">
              <div className="font-semibold">How syncing works</div>
              <div>One person sets up the household and gets a join code like <b>HP4829</b>. The other person opens the app on their phone and enters that code. Both phones then see the same meals in real time.</div>
            </div>
          </div>
        )}

        {/* Household name */}
        {step === "household" && (
          <div className="flex-1 flex flex-col">
            <div className="mb-8">
              <div className="text-3xl mb-3">🍽️</div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">What's your household name?</h1>
              <p className="text-gray-500 text-sm">This appears at the top of your Today screen.</p>
            </div>
            <input
              autoFocus
              className="w-full border border-gray-200 rounded-2xl px-4 py-3.5 text-base outline-none focus:border-orange-400 bg-white"
              placeholder="e.g. The Sharma House"
              value={householdName}
              onChange={(e) => setHouseholdName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && next()}
            />
          </div>
        )}

        {/* Member names */}
        {(step === "member-0" || step === "member-1") && (() => {
          const idx = step === "member-0" ? 0 : 1;
          const label = idx === 0 ? "First" : "Second";
          const color = AVATAR_COLORS[idx];
          return (
            <div className="flex-1 flex flex-col">
              <div className="mb-8">
                <div className={`w-12 h-12 rounded-full ${color} flex items-center justify-center text-white text-lg font-bold mb-4`}>
                  {members[idx].name ? deriveInitials(members[idx].name) : (idx + 1).toString()}
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">{label} household member</h2>
                <p className="text-gray-500 text-sm">Their name as it should appear in the app.</p>
              </div>
              <input
                autoFocus
                className="w-full border border-gray-200 rounded-2xl px-4 py-3.5 text-base outline-none focus:border-orange-400 bg-white"
                placeholder={`Member ${idx + 1}`}
                value={members[idx].name}
                onChange={(e) => updateMember(idx as 0 | 1, { name: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && next()}
              />
            </div>
          );
        })()}

        {/* Goals */}
        {(step === "goals-0" || step === "goals-1") && (() => {
          const idx = step === "goals-0" ? 0 : 1;
          const m = members[idx];
          const ring = idx === 0 ? "focus:border-orange-400" : "focus:border-rose-400";
          return (
            <div className="flex-1 flex flex-col">
              <div className="mb-6">
                <div className={`w-12 h-12 rounded-full ${AVATAR_COLORS[idx]} flex items-center justify-center text-white text-lg font-bold mb-4`}>
                  {deriveInitials(m.name || `M${idx + 1}`)}
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">
                  Daily targets for {m.name || `Member ${idx + 1}`}
                </h2>
                <p className="text-gray-500 text-sm">You can change these any time in Settings.</p>
              </div>
              <div className="space-y-4 flex-1">
                {(
                  [
                    { key: "calories", label: "Calories",      unit: "kcal", placeholder: "2000" },
                    { key: "protein",  label: "Protein",       unit: "g",    placeholder: "100"  },
                    { key: "carbs",    label: "Carbohydrates", unit: "g",    placeholder: "200"  },
                    { key: "fibre",    label: "Fibre",         unit: "g",    placeholder: "25"   },
                    { key: "fat",      label: "Fat",           unit: "g",    placeholder: "60"   },
                  ] as { key: keyof NutritionGoals; label: string; unit: string; placeholder: string }[]
                ).map(({ key, label, unit, placeholder }) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                    <div className="relative">
                      <input
                        type="number" min="0"
                        className={`w-full border border-gray-200 rounded-2xl px-4 py-3 pr-14 text-base outline-none bg-white ${ring}`}
                        placeholder={placeholder}
                        value={m.goals[key] || ""}
                        onChange={(e) => updateGoal(idx as 0 | 1, key, e.target.value)}
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">{unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Review */}
        {step === "review" && (
          <div className="flex-1 flex flex-col">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900 mb-1">Looks good?</h2>
              <p className="text-gray-500 text-sm">Review before we create your household.</p>
            </div>
            <div className="space-y-3 flex-1">
              <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3">
                <div className="text-xs text-gray-400 mb-0.5">Household</div>
                <div className="font-semibold text-gray-800">{householdName}</div>
              </div>
              {members.map((m, i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 px-4 py-3">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-8 h-8 rounded-full ${AVATAR_COLORS[i]} flex items-center justify-center text-white text-xs font-bold`}>
                      {deriveInitials(m.name || `M${i + 1}`)}
                    </div>
                    <span className="font-semibold text-gray-800">{m.name || `Member ${i + 1}`}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-xs text-gray-500">
                    <span>Calories: <b className="text-gray-700">{m.goals.calories}</b></span>
                    <span>Protein: <b className="text-gray-700">{m.goals.protein}g</b></span>
                    <span>Carbs: <b className="text-gray-700">{m.goals.carbs}g</b></span>
                    <span>Fibre: <b className="text-gray-700">{m.goals.fibre}g</b></span>
                    <span>Fat: <b className="text-gray-700">{m.goals.fat}g</b></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="pt-6">
          {step === "review" ? (
            <button
              onClick={finish}
              className="w-full py-4 rounded-2xl bg-orange-500 text-white font-semibold text-base flex items-center justify-center gap-2"
            >
              <Check className="w-5 h-5" /> Create household
            </button>
          ) : (
            <button
              onClick={next}
              disabled={!canAdvance()}
              className="w-full py-4 rounded-2xl bg-gray-900 text-white font-semibold text-base flex items-center justify-center gap-2 disabled:opacity-40"
            >
              Continue <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
