"use client";

import { useState } from "react";
import { useAppStore, generateJoinCode } from "@/lib/store";
import { HouseholdConfig, Member } from "@/lib/types";
import { deriveInitials, AVATAR_COLORS, DEFAULT_GOALS } from "@/lib/foods";
import {
  ChevronLeft, Check, Plus, Users, Copy, LogOut, ArrowRight, Loader2, AlertTriangle,
} from "lucide-react";
import { v4 as uuidv4 } from "uuid";

interface Props {
  onClose: () => void;
}

type View =
  | "list"
  | "join"
  | "create-name"
  | "create-members"
  | "create-goals-0"
  | "create-goals-1"
  | "create-review"
  | "confirm-leave";

export default function HouseholdManager({ onClose }: Props) {
  const {
    household, knownHouseholds,
    joinHousehold, createAndSwitchHousehold, switchHousehold, leaveHousehold,
  } = useAppStore();

  const [view, setView]             = useState<View>("list");
  const [busyId, setBusyId]         = useState<string | null>(null);
  const [leaveTargetId, setLeaveTargetId] = useState<string | null>(null);

  // Join form
  const [joinCode, setJoinCode]     = useState("");
  const [joinError, setJoinError]   = useState("");
  const [joining, setJoining]       = useState(false);

  // Create form
  const [newName, setNewName]       = useState("");
  const [newMembers, setNewMembers] = useState([
    { name: "", goals: { ...DEFAULT_GOALS } },
    { name: "", goals: { ...DEFAULT_GOALS } },
  ]);

  // ── Switch ────────────────────────────────────────────────────────────────

  async function handleSwitch(id: string) {
    if (id === household.householdId) return;
    setBusyId(id);
    await switchHousehold(id);
    setBusyId(null);
    onClose();
  }

  // ── Join ──────────────────────────────────────────────────────────────────

  async function handleJoin() {
    if (joinCode.trim().length < 4) return;
    setJoining(true); setJoinError("");
    const result = await joinHousehold(joinCode.trim());
    setJoining(false);
    if (result.success) { onClose(); }
    else { setJoinError(result.error ?? "Something went wrong."); }
  }

  // ── Create ────────────────────────────────────────────────────────────────

  async function handleCreate() {
    const members: Member[] = newMembers.map((m, i) => ({
      id:          uuidv4(),
      name:        m.name.trim() || `Member ${i + 1}`,
      initials:    deriveInitials(m.name.trim() || `Member ${i + 1}`),
      avatarColor: AVATAR_COLORS[i],
      goals:       m.goals,
    }));

    const config: HouseholdConfig = {
      householdName:       newName.trim(),
      members,
      onboardingComplete:  true,
      householdId:         uuidv4(),
      joinCode:            generateJoinCode(),
    };

    await createAndSwitchHousehold(config);
    onClose();
  }

  // ── Leave ─────────────────────────────────────────────────────────────────

  function confirmLeave(id: string) {
    setLeaveTargetId(id);
    setView("confirm-leave");
  }

  function doLeave() {
    if (leaveTargetId) leaveHousehold(leaveTargetId);
    setView("list");
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const backBtn = (to: View) => (
    <button onClick={() => setView(to)} className="p-2 rounded-xl hover:bg-gray-100 mr-1">
      <ChevronLeft className="w-5 h-5 text-gray-600" />
    </button>
  );

  // ── List view ─────────────────────────────────────────────────────────────
  if (view === "list") return (
    <div className="space-y-4">
      <div className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Households</div>

      {knownHouseholds.length === 0 && (
        <div className="text-sm text-gray-400 text-center py-4">No households found.</div>
      )}

      {knownHouseholds.map((h) => {
        const isActive = h.householdId === household.householdId;
        const busy     = busyId === h.householdId;
        return (
          <div key={h.householdId} className={`rounded-2xl border px-4 py-3 ${isActive ? "border-orange-200 bg-orange-50" : "border-gray-100 bg-white"}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-gray-800 flex items-center gap-2">
                  {h.householdName}
                  {isActive && (
                    <span className="text-xs font-medium text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">Active</span>
                  )}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {h.memberCount} member{h.memberCount !== 1 ? "s" : ""} · Code: {h.joinCode}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {!isActive && (
                  <button onClick={() => handleSwitch(h.householdId)} disabled={busy}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gray-900 text-white text-xs font-medium disabled:opacity-50">
                    {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowRight className="w-3 h-3" />}
                    Switch
                  </button>
                )}
                <button onClick={() => confirmLeave(h.householdId)}
                  className="p-2 rounded-xl hover:bg-red-50 text-gray-400 hover:text-red-400 transition-colors">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        );
      })}

      <div className="flex gap-2 pt-1">
        <button onClick={() => setView("join")}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">
          <Users className="w-4 h-4" /> Join another
        </button>
        <button onClick={() => setView("create-name")}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">
          <Plus className="w-4 h-4" /> Create new
        </button>
      </div>
    </div>
  );

  // ── Join view ─────────────────────────────────────────────────────────────
  if (view === "join") return (
    <div className="space-y-4">
      <div className="flex items-center gap-1">
        {backBtn("list")}
        <span className="font-semibold text-gray-800">Join a household</span>
      </div>
      <p className="text-sm text-gray-500">Enter the 6-character join code from the other household's Settings screen.</p>
      <input
        autoFocus
        className="w-full border border-gray-200 rounded-2xl px-4 py-4 text-2xl font-bold tracking-widest uppercase text-center outline-none focus:border-orange-400 text-gray-900 bg-white"
        placeholder="HP····"
        value={joinCode} maxLength={8}
        onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setJoinError(""); }}
        onKeyDown={(e) => e.key === "Enter" && handleJoin()}
      />
      {joinError && <p className="text-sm text-red-500 text-center">{joinError}</p>}
      <button onClick={handleJoin} disabled={joinCode.trim().length < 4 || joining}
        className="w-full py-4 rounded-2xl bg-gray-900 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-40">
        {joining ? <><Loader2 className="w-4 h-4 animate-spin" /> Joining…</> : "Join household"}
      </button>
    </div>
  );

  // ── Create — name ─────────────────────────────────────────────────────────
  if (view === "create-name") return (
    <div className="space-y-4">
      <div className="flex items-center gap-1">
        {backBtn("list")}
        <span className="font-semibold text-gray-800">New household</span>
      </div>
      <p className="text-sm text-gray-500">Creating a new household will not affect your existing one.</p>
      <input autoFocus
        className="w-full border border-gray-200 rounded-2xl px-4 py-3.5 text-base outline-none focus:border-orange-400 text-gray-900 bg-white"
        placeholder="Household name (e.g. Our Home)"
        value={newName} onChange={(e) => setNewName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && newName.trim() && setView("create-members")}
      />
      <button onClick={() => setView("create-members")} disabled={!newName.trim()}
        className="w-full py-3 rounded-2xl bg-gray-900 text-white font-semibold disabled:opacity-40">
        Continue
      </button>
    </div>
  );

  // ── Create — members ──────────────────────────────────────────────────────
  if (view === "create-members") return (
    <div className="space-y-4">
      <div className="flex items-center gap-1">
        {backBtn("create-name")}
        <span className="font-semibold text-gray-800">Members</span>
      </div>
      {newMembers.map((m, i) => (
        <div key={i}>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {i === 0 ? "First" : "Second"} member
          </label>
          <input
            className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-base outline-none focus:border-orange-400 text-gray-900 bg-white"
            placeholder={`Member ${i + 1}`}
            value={m.name}
            onChange={(e) => {
              const next = [...newMembers];
              next[i] = { ...next[i], name: e.target.value };
              setNewMembers(next);
            }}
          />
        </div>
      ))}
      <button onClick={() => setView("create-goals-0")}
        className="w-full py-3 rounded-2xl bg-gray-900 text-white font-semibold">
        Set calorie targets →
      </button>
    </div>
  );

  // ── Create — goals ────────────────────────────────────────────────────────
  if (view === "create-goals-0" || view === "create-goals-1") {
    const idx    = view === "create-goals-0" ? 0 : 1;
    const m      = newMembers[idx];
    const nextV  = view === "create-goals-0" ? "create-goals-1" : "create-review";
    const backV  = view === "create-goals-0" ? "create-members" : "create-goals-0";

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-1">
          {backBtn(backV)}
          <span className="font-semibold text-gray-800">
            Targets for {m.name || `Member ${idx + 1}`}
          </span>
        </div>
        {([
          {k:"calories",l:"Calories",u:"kcal",ph:"2000"},
          {k:"protein", l:"Protein", u:"g",   ph:"100"},
          {k:"carbs",   l:"Carbs",   u:"g",   ph:"200"},
          {k:"fibre",   l:"Fibre",   u:"g",   ph:"25"},
          {k:"fat",     l:"Fat",     u:"g",   ph:"60"},
        ] as {k:keyof typeof DEFAULT_GOALS;l:string;u:string;ph:string}[]).map(({k,l,u,ph}) => (
          <div key={k} className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">{l}</label>
            <input type="number" min="0"
              value={m.goals[k] || ""}
              onChange={(e) => {
                const next = [...newMembers];
                next[idx] = { ...next[idx], goals: { ...next[idx].goals, [k]: parseInt(e.target.value)||0 } };
                setNewMembers(next);
              }}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 pr-12 text-sm outline-none focus:border-orange-400 text-gray-900 bg-white"
              placeholder={ph}
            />
            <span className="absolute right-3 top-[2.1rem] text-xs text-gray-400">{u}</span>
          </div>
        ))}
        <button onClick={() => setView(nextV)}
          className="w-full py-3 rounded-2xl bg-gray-900 text-white font-semibold">
          {view === "create-goals-0" ? "Next member →" : "Review →"}
        </button>
      </div>
    );
  }

  // ── Create — review ───────────────────────────────────────────────────────
  if (view === "create-review") return (
    <div className="space-y-4">
      <div className="flex items-center gap-1">
        {backBtn("create-goals-1")}
        <span className="font-semibold text-gray-800">Review</span>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3">
        <div className="text-xs text-gray-400 mb-0.5">Household</div>
        <div className="font-semibold text-gray-800">{newName}</div>
      </div>
      {newMembers.map((m, i) => (
        <div key={i} className="bg-white rounded-2xl border border-gray-100 px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-7 h-7 rounded-full ${AVATAR_COLORS[i]} flex items-center justify-center text-white text-xs font-bold`}>
              {deriveInitials(m.name || `M${i+1}`)}
            </div>
            <span className="font-semibold text-gray-800">{m.name || `Member ${i+1}`}</span>
          </div>
          <div className="text-xs text-gray-500">
            {m.goals.calories} kcal · {m.goals.protein}g P · {m.goals.carbs}g C · {m.goals.fibre}g F · {m.goals.fat}g fat
          </div>
        </div>
      ))}
      <button onClick={handleCreate}
        className="w-full py-4 rounded-2xl bg-orange-500 text-white font-semibold flex items-center justify-center gap-2">
        <Check className="w-5 h-5" /> Create household
      </button>
    </div>
  );

  // ── Confirm leave ─────────────────────────────────────────────────────────
  if (view === "confirm-leave") {
    const target = knownHouseholds.find((h) => h.householdId === leaveTargetId);
    const isActive = leaveTargetId === household.householdId;
    const isLast   = knownHouseholds.length <= 1;

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-1">
          {backBtn("list")}
          <span className="font-semibold text-gray-800">Leave household?</span>
        </div>
        <div className="bg-amber-50 rounded-2xl px-4 py-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-amber-700 space-y-1">
            <div>You are about to leave <strong>{target?.householdName}</strong>.</div>
            <div>Your diary data remains in Supabase. You can rejoin using the code <strong>{target?.joinCode}</strong>.</div>
            {isActive && !isLast && <div>You will be switched to your next household.</div>}
            {isLast && <div className="font-semibold">This is your only household. You will need to set up or join one to continue using HomePlate.</div>}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setView("list")} className="flex-1 py-3 rounded-2xl bg-gray-100 text-gray-700 font-semibold">Cancel</button>
          <button onClick={doLeave} className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-semibold">Leave</button>
        </div>
      </div>
    );
  }

  return null;
}
