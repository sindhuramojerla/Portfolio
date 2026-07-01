"use client";

import { useState, useMemo } from "react";
import {
  MealType, Member, FoodCategory, SupabaseFood,
  Nutrition, LoggedFood, FoodItem, CustomFoodItem,
} from "@/lib/types";
import { ADDED_INGREDIENTS } from "@/lib/foods";
import { calculateNutritionV2, supabaseFoodToFoodItem, servingLabel } from "@/lib/foodCalc";
import { useAppStore } from "@/lib/store";
import { getMemberColors } from "@/lib/colors";
import {
  X, ChevronLeft, Search, Plus, Zap, ChevronRight, Check, AlertTriangle,
} from "lucide-react";
import { v4 as uuidv4 } from "uuid";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  meal: MealType;
  member: Member;
  allMembers: Member[];
  onClose: () => void;
  onAdded: () => void;
  onDone: () => void;
}

type Mode = "pick" | "search" | "create" | "quick";
type WhoAte = string | "both";
type SearchStep = "list" | "who-ate" | "detail" | "both-portions" | "edit-nutrition";

// ─── Main component ───────────────────────────────────────────────────────────

export default function AddFoodSheet({ meal, member, allMembers, onClose, onAdded, onDone }: Props) {
  const { getMemberFoodsForMeal } = useAppStore();
  const [mode, setMode] = useState<Mode>("pick");
  const existingFoods = getMemberFoodsForMeal(meal, member.id);

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100 flex-shrink-0">
        {mode !== "pick" ? (
          <button onClick={() => setMode("pick")} className="p-2 rounded-xl hover:bg-gray-100">
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
        ) : <div className="w-9" />}

        <div className="flex-1">
          <div className="font-semibold text-gray-800">{meal} · {member.name}</div>
          <div className="text-xs text-gray-400">
            {existingFoods.length > 0
              ? `${existingFoods.length} item${existingFoods.length !== 1 ? "s" : ""} logged`
              : "No food added yet"}
          </div>
        </div>

        <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100">
          <X className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {mode === "pick"   && <PickMode member={member} onSearch={() => setMode("search")} onCreate={() => setMode("create")} onQuick={() => setMode("quick")} onDone={onDone} existingCount={existingFoods.length} />}
        {mode === "search" && <SearchMode meal={meal} member={member} allMembers={allMembers} onAdded={() => { onAdded(); setMode("pick"); }} onCreateNew={() => setMode("create")} />}
        {mode === "create" && <CreateMode meal={meal} member={member} allMembers={allMembers} onAdded={() => { onAdded(); setMode("pick"); }} />}
        {mode === "quick"  && <QuickMode  meal={meal} member={member} allMembers={allMembers} onAdded={() => { onAdded(); setMode("pick"); }} />}
      </div>
    </div>
  );
}

// ─── Pick mode ────────────────────────────────────────────────────────────────

function PickMode({ member, onSearch, onCreate, onQuick, onDone, existingCount }: {
  member: Member; onSearch:()=>void; onCreate:()=>void; onQuick:()=>void; onDone:()=>void; existingCount:number;
}) {
  return (
    <div className="px-4 py-6 space-y-3">
      <PickCard icon={<Search className="w-5 h-5 text-orange-600" />} bg="bg-orange-50" title="Search Foods" desc="Browse homemade, basic, packaged & saved foods" onClick={onSearch} />
      <PickCard icon={<Plus className="w-5 h-5 text-violet-600" />}   bg="bg-violet-50"  title="Create New Food" desc="Add a custom food, optionally save it" onClick={onCreate} />
      <PickCard icon={<Zap className="w-5 h-5 text-amber-600" />}     bg="bg-amber-50"   title="Quick Calorie Entry" desc="Estimate calories when details are unknown" onClick={onQuick} />
      {existingCount > 0 && (
        <button onClick={onDone} className="w-full mt-4 py-4 rounded-2xl bg-gray-900 text-white font-semibold text-base">
          Done — close log
        </button>
      )}
    </div>
  );
}

function PickCard({ icon, bg, title, desc, onClick }: { icon:React.ReactNode; bg:string; title:string; desc:string; onClick:()=>void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-4 px-4 py-4 bg-white rounded-2xl border border-gray-100 shadow-sm text-left active:bg-gray-50 transition-colors">
      <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>{icon}</div>
      <div className="flex-1">
        <div className="font-semibold text-gray-800">{title}</div>
        <div className="text-xs text-gray-400 mt-0.5">{desc}</div>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-300" />
    </button>
  );
}

// ─── Search mode ──────────────────────────────────────────────────────────────

function SearchMode({ meal, member, allMembers, onAdded, onCreateNew }: {
  meal:MealType; member:Member; allMembers:Member[]; onAdded:()=>void; onCreateNew:()=>void;
}) {
  const { addFood, foods, customFoods, recentFoodCodes } = useAppStore();
  const mc = getMemberColors(member.avatarColor);

  // Search / filter
  const [query, setQuery]           = useState("");
  const [activeCat, setActiveCat]   = useState<FoodCategory | "All" | "Recent" | "Saved">("All");

  // Flow steps
  const [step, setStep]             = useState<SearchStep>("list");
  const [selFood, setSelFood]       = useState<SupabaseFood | null>(null);
  const [whoAte, setWhoAte]         = useState<WhoAte>(member.id);

  // Single-member detail — qty is a string so the user can clear and retype
  const [qtyStr, setQtyStr]         = useState("1");
  const [unit, setUnit]             = useState("katori");
  const [prepChoices, setPrepChoices] = useState<Record<string,string>>({});
  const [addedIngs, setAddedIngs]   = useState<string[]>([]);
  const [isCustomQty, setIsCustomQty] = useState(false);

  // Parsed numeric value (0 when empty — used for calculation)
  const qty = parseFloat(qtyStr) || 0;

  // Both-portions — also strings
  const [memberQtyStrs, setMemberQtyStrs] = useState<Record<string,string>>(
    () => Object.fromEntries(allMembers.map((m) => [m.id, "1"]))
  );
  const [memberUnits, setMemberUnits] = useState<Record<string,string>>(
    () => Object.fromEntries(allMembers.map((m) => [m.id, "katori"]))
  );

  // Nutrition editing
  const [editNutrition, setEditNutrition] = useState<Nutrition | null>(null);

  // ── food list ──
  const allFoods: SupabaseFood[] = useMemo(() => foods, [foods]);

  const recentFoods = useMemo(() =>
    recentFoodCodes.flatMap((code) => allFoods.filter((f) => f.food_code === code)).slice(0, 6),
    [recentFoodCodes, allFoods]
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (activeCat === "Recent") return recentFoods.filter((f) => f.name.toLowerCase().includes(q));
    if (activeCat === "Saved")  return allFoods.filter((f) => f.food_type !== "global" && f.name.toLowerCase().includes(q));
    return allFoods.filter((f) => {
      const matchCat = activeCat === "All" || f.category === activeCat;
      const matchQ   = f.name.toLowerCase().includes(q) ||
                       f.aliases.some((a) => a.toLowerCase().includes(q));
      return matchCat && matchQ;
    });
  }, [allFoods, recentFoods, activeCat, query]);

  function selectFood(food: SupabaseFood) {
    setSelFood(food);
    setQtyStr(String(food.default_serving_qty));
    setUnit(food.default_serving_unit);
    setPrepChoices({});
    setAddedIngs([]);
    setEditNutrition(null);
    setIsCustomQty(false);
    setMemberQtyStrs(Object.fromEntries(allMembers.map((m) => [m.id, String(food.default_serving_qty)])));
    setMemberUnits(Object.fromEntries(allMembers.map((m) => [m.id, food.default_serving_unit])));
    setStep(food.category === "Homemade" || food.preparation_options.length > 0 ? "who-ate" : "detail");
  }

  function liveNutrition(food: SupabaseFood, q: number, u: string): Nutrition {
    return calculateNutritionV2(food, q, u, prepChoices, addedIngs);
  }

  function doLog() {
    if (!selFood || qty === 0) return;
    if (whoAte === "both") {
      for (const m of allMembers) {
        const mq = parseFloat(memberQtyStrs[m.id]) || 0;
        const mu = memberUnits[m.id];
        const nutr = editNutrition || calculateNutritionV2(selFood, mq, mu, prepChoices, addedIngs);
        addFood(buildLoggedFood(selFood, m.id, mq, mu, nutr, prepChoices, addedIngs));
      }
    } else {
      const nutr = editNutrition || calculateNutritionV2(selFood, qty, unit, prepChoices, addedIngs);
      addFood(buildLoggedFood(selFood, whoAte, qty, unit, nutr, prepChoices, addedIngs));
    }
    onAdded();
  }

  function buildLoggedFood(
    food: SupabaseFood, memberId: string,
    q: number, u: string,
    nutr: Nutrition,
    prep: Record<string,string>,
    additions: string[]
  ): LoggedFood {
    return {
      id: uuidv4(),
      foodItem: supabaseFoodToFoodItem(food),
      foodCode: food.food_code,
      memberId, meal,
      servingQty: q, servingUnit: u,
      portion: servingLabel(q, u),
      prepChoices: prep,
      addedIngredients: additions,
      nutrition: nutr,
      timestamp: new Date().toISOString(),
      entryType: "search",
    };
  }

  // ── Edit Nutrition ──
  if (step === "edit-nutrition" && selFood) {
    const currentNutr = editNutrition || liveNutrition(selFood, qty, unit);

    return (
      <div className="px-4 py-4 space-y-4 pb-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-bold text-gray-800">{selFood.name}</div>
            <div className="text-sm text-gray-400 mt-0.5">Edit nutrition values</div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
          <div className="text-xs font-semibold text-gray-600 uppercase">Current values ({qty} {unit})</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-orange-600">{Math.round(currentNutr.calories)}</div>
              <div className="text-xs text-gray-500 mt-1">Calories</div>
            </div>
            <div className="bg-white rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-blue-600">{currentNutr.protein.toFixed(1)}</div>
              <div className="text-xs text-gray-500 mt-1">Protein (g)</div>
            </div>
            <div className="bg-white rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-yellow-600">{currentNutr.carbs.toFixed(1)}</div>
              <div className="text-xs text-gray-500 mt-1">Carbs (g)</div>
            </div>
            <div className="bg-white rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-red-600">{currentNutr.fat.toFixed(1)}</div>
              <div className="text-xs text-gray-500 mt-1">Fat (g)</div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-xs font-semibold text-gray-600 uppercase">Adjust values</div>
          <Field label="Calories" unit="kcal">
            <input type="number" step="1" value={editNutrition?.calories ?? currentNutr.calories}
              onChange={(e) => setEditNutrition({...(editNutrition || currentNutr), calories: parseFloat(e.target.value) || 0})}
              className={INPUT} />
          </Field>
          <Field label="Protein" unit="g">
            <input type="number" step="0.1" value={editNutrition?.protein ?? currentNutr.protein}
              onChange={(e) => setEditNutrition({...(editNutrition || currentNutr), protein: parseFloat(e.target.value) || 0})}
              className={INPUT} />
          </Field>
          <Field label="Carbs" unit="g">
            <input type="number" step="0.1" value={editNutrition?.carbs ?? currentNutr.carbs}
              onChange={(e) => setEditNutrition({...(editNutrition || currentNutr), carbs: parseFloat(e.target.value) || 0})}
              className={INPUT} />
          </Field>
          <Field label="Fibre" unit="g">
            <input type="number" step="0.1" value={editNutrition?.fibre ?? currentNutr.fibre}
              onChange={(e) => setEditNutrition({...(editNutrition || currentNutr), fibre: parseFloat(e.target.value) || 0})}
              className={INPUT} />
          </Field>
          <Field label="Fat" unit="g">
            <input type="number" step="0.1" value={editNutrition?.fat ?? currentNutr.fat}
              onChange={(e) => setEditNutrition({...(editNutrition || currentNutr), fat: parseFloat(e.target.value) || 0})}
              className={INPUT} />
          </Field>
        </div>

        <div className="text-xs text-gray-500 bg-blue-50 p-3 rounded-xl">
          💡 Changes only affect this meal entry — the food recipe stays unchanged.
        </div>

        <div className="flex gap-2">
          <button onClick={() => { setEditNutrition(null); setStep(whoAte === "both" ? "both-portions" : "detail"); }}
            className="flex-1 py-3 rounded-2xl bg-gray-200 text-gray-800 font-semibold active:bg-gray-300">
            Back
          </button>
          <button onClick={() => setStep(whoAte === "both" ? "both-portions" : "detail")}
            className="flex-1 py-3 rounded-2xl bg-orange-500 text-white font-semibold active:bg-orange-600">
            Done Editing
          </button>
        </div>
      </div>
    );
  }

  // ── Who ate ──
  if (step === "who-ate" && selFood) {
    return (
      <div className="px-4 py-6 space-y-4">
        <div>
          <div className="text-lg font-bold text-gray-800">{selFood.name}</div>
          <div className="text-sm text-gray-400 mt-0.5">Who ate this?</div>
        </div>
        {allMembers.map((m) => (
          <button key={m.id} onClick={() => { setWhoAte(m.id); setStep("detail"); }}
            className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl bg-gray-50 active:bg-gray-100 text-left">
            <div className={`w-8 h-8 rounded-full ${getMemberColors(m.avatarColor).bg} flex items-center justify-center text-white text-xs font-bold`}>{m.initials}</div>
            <span className="text-base font-medium text-gray-800">{m.name}</span>
          </button>
        ))}
        <button onClick={() => { setWhoAte("both"); setStep("detail"); }}
          className="w-full flex items-center justify-between px-4 py-4 rounded-2xl bg-gray-50 active:bg-gray-100">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-8">
              {allMembers.slice(0,2).map((m,i) => (
                <div key={m.id} className={`absolute w-8 h-8 rounded-full ${getMemberColors(m.avatarColor).bg} flex items-center justify-center text-white text-xs font-bold border-2 border-white`} style={{left:i*12}}>{m.initials[0]}</div>
              ))}
            </div>
            <span className="text-base font-medium text-gray-800">Both</span>
          </div>
          <span className="text-xs text-gray-400">Set portions separately</span>
        </button>
      </div>
    );
  }

  // ── Detail ──
  if (step === "detail" && selFood) {
    const nutr = whoAte !== "both" ? liveNutrition(selFood, qty, unit) : null;
    const isDraft = selFood.confidence === "draft";

    return (
      <div className="px-4 py-4 space-y-5 pb-24">
        <div>
          <div className="text-lg font-bold text-gray-800">{selFood.name}</div>
          {whoAte === "both" && <div className="text-sm text-orange-500 font-medium mt-0.5">Shared dish</div>}
          {isDraft && (
            <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              Nutrition values are approximate — verify with product label or recipe.
            </div>
          )}
        </div>

        {/* Preparation options */}
        {selFood.preparation_options.map((group) => (
          <div key={group.key} className="space-y-2">
            <div className="text-sm font-semibold text-gray-700">{group.label}</div>
            <div className="flex gap-2 flex-wrap">
              {group.options.map((opt) => {
                const active = (prepChoices[group.key] ?? group.options[0]?.value) === opt.value;
                return (
                  <button key={opt.value}
                    onClick={() => setPrepChoices((p) => ({ ...p, [group.key]: opt.value }))}
                    className={`flex-1 min-w-[5rem] py-2 rounded-xl text-sm font-medium border transition-colors ${active ? "bg-orange-500 text-white border-orange-500" : "bg-white text-gray-600 border-gray-200"}`}>
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Additions */}
        {selFood.allowed_additions.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-semibold text-gray-700">Added ingredients <span className="font-normal text-gray-400">(optional)</span></div>
            <div className="flex flex-wrap gap-2">
              {selFood.allowed_additions.map((name) => (
                <button key={name}
                  onClick={() => setAddedIngs((p) => p.includes(name) ? p.filter((i) => i !== name) : [...p, name])}
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors ${addedIngs.includes(name) ? "bg-orange-500 text-white border-orange-500" : "bg-white text-gray-600 border-gray-200"}`}>
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Portion — single member */}
        {whoAte !== "both" && (
          <>
            <div className="space-y-2">
              <div className="text-sm font-semibold text-gray-700">Amount</div>

              {/* Unit selector (if >1 allowed unit) */}
              {selFood.allowed_units.length > 1 && (
                <div className="flex gap-2 mb-2">
                  {selFood.allowed_units.map((u) => (
                    <button key={u} onClick={() => setUnit(u)}
                      className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors ${unit === u ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200"}`}>
                      {u}
                    </button>
                  ))}
                </div>
              )}

              {/* Portion presets - Only show if unit matches default */}
              {unit === selFood.default_serving_unit && selFood.portion_presets.filter((p) => p.qty > 0).length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {selFood.portion_presets
                    .filter((p) => p.qty > 0)
                    .map((p) => (
                      <button key={`${p.qty}-${p.label}`}
                        onClick={() => { setQtyStr(String(p.qty)); setIsCustomQty(false); }}
                        className={`py-3 rounded-xl text-sm font-medium border transition-colors ${qty === p.qty && !isCustomQty ? "bg-orange-500 text-white border-orange-500" : "bg-white text-gray-600 border-gray-200"}`}>
                        {p.label}
                      </button>
                    ))}
                  <button
                    onClick={() => setIsCustomQty(true)}
                    className={`py-3 rounded-xl text-sm font-medium border transition-colors ${isCustomQty ? "bg-orange-500 text-white border-orange-500" : "bg-white text-gray-600 border-gray-200"}`}>
                    Custom
                  </button>
                </div>
              )}

              {/* Fallback: Show input + Custom when no presets for unit */}
              {unit !== selFood.default_serving_unit && (
                <div className="text-xs text-gray-500 bg-blue-50 p-3 rounded-xl mb-2">
                  💡 No presets available for {unit} — use custom input below
                </div>
              )}

              {/* Custom quantity input */}
              <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 transition-colors ${isCustomQty ? "border-orange-400 bg-orange-50" : "border-gray-200 bg-white"}`}>
                <input type="number" min="0.1" step="0.1" value={qtyStr}
                  onChange={(e) => { setQtyStr(e.target.value); setIsCustomQty(true); }}
                  autoFocus={isCustomQty}
                  className="flex-1 outline-none text-sm text-gray-900 bg-transparent" />
                <span className="text-sm text-gray-500 font-medium">{unit}</span>
              </div>

              {/* Unit conversion hint - Only show if not already in grams */}
              {unit !== "gram" && unit !== selFood.default_serving_unit && selFood.grams_per_default_unit && (
                <div className="text-xs text-gray-500 flex items-center gap-1">
                  <span>≈</span>
                  <span>{(qty * (selFood.grams_per_default_unit / (selFood.default_serving_qty || 1))).toFixed(0)}g</span>
                </div>
              )}
            </div>

            {/* Nutrition preview */}
            {nutr && (
              <div className={`${mc.light} rounded-2xl p-4 space-y-2`}>
                <div className={`text-xs font-semibold uppercase tracking-wide ${mc.text}`}>Nutrition preview</div>
                <div className="flex items-end gap-1">
                  <span className={`text-2xl font-bold ${mc.text}`}>{nutr.calories}</span>
                  <span className={`text-sm mb-0.5 ${mc.text} opacity-70`}>kcal</span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  {[["Protein",nutr.protein],["Carbs",nutr.carbs],["Fibre",nutr.fibre],["Fat",nutr.fat]].map(([l,v]) => (
                    <div key={l as string}>
                      <div className={`${mc.text} opacity-70`}>{l}</div>
                      <div className={`font-semibold ${mc.text}`}>{Math.round((v as number)*10)/10}g</div>
                    </div>
                  ))}
                </div>
                {selFood.confidence !== "validated" && (
                  <div className={`text-xs ${mc.text} opacity-60 pt-1`}>
                    {selFood.confidence === "draft"
                      ? "⚠️ Draft values — check product label before trusting."
                      : "Approximate nutrition based on standard recipe."}
                  </div>
                )}
              </div>
            )}
            <button onClick={doLog} disabled={qty === 0} className="w-full py-4 rounded-2xl bg-orange-500 text-white font-semibold text-base active:bg-orange-600 disabled:opacity-40">
              Add to {meal}
            </button>
          </>
        )}

        {whoAte === "both" && (
          <button onClick={() => setStep("both-portions")} className="w-full py-3 rounded-2xl bg-orange-500 text-white font-semibold">
            Set portions for each person →
          </button>
        )}
      </div>
    );
  }

  // ── Both portions ──
  if (step === "both-portions" && selFood) {
    return (
      <div className="px-4 py-4 space-y-5 pb-24">
        <div className="text-base font-bold text-gray-800">Set portions</div>
        {allMembers.map((m) => {
          const mq   = parseFloat(memberQtyStrs[m.id]) || 0;
          const mu   = memberUnits[m.id];
          const mc2  = getMemberColors(m.avatarColor);
          const prev = calculateNutritionV2(selFood, mq, mu, prepChoices, addedIngs).calories;

          return (
            <div key={m.id} className="space-y-2">
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full ${mc2.bg} flex items-center justify-center text-white text-xs font-bold`}>{m.initials}</div>
                <span className="text-sm font-semibold text-gray-700">{m.name}</span>
              </div>
              {selFood.allowed_units.length > 1 && (
                <div className="flex gap-2">
                  {selFood.allowed_units.map((u) => (
                    <button key={u} onClick={() => setMemberUnits((p) => ({ ...p, [m.id]: u }))}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-medium border transition-colors ${mu === u ? `${mc2.bg} text-white ${mc2.border}` : "bg-white text-gray-600 border-gray-200"}`}>
                      {u}
                    </button>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                {selFood.portion_presets.map((p) => (
                  <button key={p.label}
                    onClick={() => setMemberQtyStrs((prev2) => ({ ...prev2, [m.id]: String(p.qty) }))}
                    className={`py-2.5 rounded-xl text-sm font-medium border transition-colors ${mq === p.qty ? `${mc2.bg} text-white ${mc2.border}` : "bg-white text-gray-600 border-gray-200"}`}>
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input type="number" min="0.1" step="0.1" value={memberQtyStrs[m.id]}
                  onChange={(e) => setMemberQtyStrs((p) => ({ ...p, [m.id]: e.target.value }))}
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none text-gray-900 bg-white" />
                <span className="text-xs text-gray-400">{mu}</span>
              </div>
              <div className="text-xs text-gray-400">≈ {prev} kcal</div>
            </div>
          );
        })}
        <div className="flex gap-2">
          <button onClick={() => setStep("edit-nutrition")} className="flex-1 py-4 rounded-2xl bg-gray-200 text-gray-800 font-semibold text-base active:bg-gray-300">
            Edit Nutrition
          </button>
          <button onClick={doLog} disabled={allMembers.some((m) => !memberQtyStrs[m.id] || parseFloat(memberQtyStrs[m.id]) === 0)} className="flex-1 py-4 rounded-2xl bg-orange-500 text-white font-semibold text-base active:bg-orange-600 disabled:opacity-40">
            Add to {meal}
          </button>
        </div>
      </div>
    );
  }

  // ── Food list ──
  const CATS: { key: FoodCategory | "All" | "Recent" | "Saved"; icon: string; label: string }[] = [
    { key: "All",            icon: "🔍", label: "All"       },
    { key: "Recent",         icon: "🕐", label: "Recent"    },
    { key: "Homemade",       icon: "🍲", label: "Curries"   },
    { key: "Basic Foods",    icon: "🍚", label: "Basics"    },
    { key: "Protein",        icon: "🍗", label: "Protein"   },
    { key: "Fruits",         icon: "🍌", label: "Fruits"    },
    { key: "Drinks",         icon: "☕", label: "Drinks"    },
    { key: "Packaged Foods", icon: "📦", label: "Packaged"  },
    { key: "Additions",      icon: "➕", label: "Extras"    },
    { key: "Saved",          icon: "⭐", label: "Saved"     },
  ];

  return (
    <div className="px-4 py-4 space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input className="w-full pl-9 pr-4 py-3 bg-gray-100 rounded-2xl text-sm outline-none placeholder:text-gray-400 text-gray-900"
          placeholder="Search foods…" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
      </div>

      <div className="grid grid-cols-5 gap-1.5">
        {CATS.map(({ key, icon, label }) => (
          <button key={key} onClick={() => setActiveCat(key)}
            className={`flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl text-center transition-colors ${
              activeCat === key
                ? "bg-orange-500 text-white"
                : "bg-gray-50 text-gray-600 active:bg-gray-100"
            }`}>
            <span className="text-base leading-none">{icon}</span>
            <span className="text-xs font-medium leading-tight">{label}</span>
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        {filtered.map((food) => (
          <button key={food.id} onClick={() => selectFood(food)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-gray-50 active:bg-gray-100 text-left hover:bg-orange-50 transition">
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-800 flex items-center gap-1.5">
                {food.name}
                {food.confidence === "draft" && (
                  <span className="text-xs text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded-md">draft</span>
                )}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                {food.food_type !== "global" ? "Saved" : food.category}
                {" · "}{food.default_serving_qty}{food.default_serving_qty !== 1 ? "" : ""} {food.default_serving_unit}
              </div>
              <div className="text-xs text-gray-500 mt-1.5 flex gap-3">
                <span className="font-medium">{food.calories} cal</span>
                <span>P: {food.protein}g</span>
                <span>C: {food.carbs}g</span>
                <span>F: {food.fat}g</span>
              </div>
            </div>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">No foods match "{query}"</div>
        )}
      </div>

      <button onClick={onCreateNew}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-gray-200 text-gray-500 text-sm font-medium active:bg-gray-50">
        <Plus className="w-4 h-4" />
        Can&apos;t find it? Create a new food
      </button>
    </div>
  );
}

// ─── Create mode ──────────────────────────────────────────────────────────────

function CreateMode({ meal, member, allMembers, onAdded }: {
  meal:MealType; member:Member; allMembers:Member[]; onAdded:()=>void;
}) {
  const { addFood, addCustomFood, household } = useAppStore();
  const [name, setName]             = useState("");
  const [category, setCategory]     = useState<FoodCategory>("Basic Foods");
  const [servingName, setServingName] = useState("1 serving");
  const [cals, setCals]             = useState("");
  const [protein, setProtein]       = useState("");
  const [carbs, setCarbs]           = useState("");
  const [fibre, setFibre]           = useState("");
  const [fat, setFat]               = useState("");
  const [whoAte, setWhoAte]         = useState<WhoAte>(member.id);
  const [saveMode, setSaveMode]     = useState<"once"|"mine"|"household">("once");
  const [saving, setSaving]         = useState(false);
  const [saveError, setSaveError]   = useState<string | null>(null);

  const calories    = parseFloat(cals) || 0;
  const canSubmit   = name.trim().length > 0 && calories > 0;
  const nutrition: Nutrition = {
    calories,
    protein:  parseFloat(protein) || 0,
    carbs:    parseFloat(carbs)   || 0,
    fibre:    parseFloat(fibre)   || 0,
    fat:      parseFloat(fat)     || 0,
  };

  async function handleAdd() {
    if (!canSubmit || saving) return;
    setSaving(true);
    setSaveError(null);

    let foodItem: FoodItem = {
      id: uuidv4(), name: name.trim(), category,
      baseNutrition: nutrition, unit: servingName, source: "custom",
    };

    if (saveMode !== "once" && household.householdId) {
      try {
        console.log("💾 Saving custom food to Supabase...", {
          householdId: household.householdId,
          householdIdType: typeof household.householdId,
          householdIdLength: household.householdId?.length,
          name
        });
        const saved = await addCustomFood({
          householdId:         household.householdId,
          createdByMemberId:   member.id,
          name:                name.trim(),
          category,
          servingName,
          nutrition,
          scope: saveMode === "household" ? "household" : "personal",
        });
        console.log("✅ Food saved successfully!", saved);
        foodItem = { ...foodItem, id: saved.id };
      } catch (err) {
        console.error("❌ Error saving custom food:", err);

        // Extract error message from various error types
        let errMsg = "Unknown error";
        if (err instanceof Error) {
          errMsg = err.message;
        } else if (err && typeof err === "object") {
          const errorObj = err as any;
          errMsg = errorObj.message || errorObj.error_description || errorObj.error || String(err);
        }

        console.error("📋 Error details:", { errMsg, fullError: err });
        setSaveError(`Failed to save: ${errMsg}`);
        setSaving(false);
        return;
      }
    }

    const targets = whoAte === "both" ? allMembers : allMembers.filter((m) => m.id === whoAte);
    for (const m of targets) {
      addFood({
        id: uuidv4(), foodItem, memberId: m.id, meal,
        servingQty: 1, servingUnit: servingName,
        portion: servingName, nutrition,
        timestamp: new Date().toISOString(), entryType: "search",
      });
    }
    setSaving(false);
    onAdded();
  }

  return (
    <div className="px-4 py-4 space-y-4 pb-8">
      {saveError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          ⚠️ {saveError}
        </div>
      )}

      <Field label="Food name" required>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={INPUT} placeholder="Required" />
      </Field>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Food type</label>
        <div className="flex gap-2">
          {(["Homemade","Basic Foods","Packaged Foods"] as FoodCategory[]).map((c) => (
            <button key={c} onClick={() => setCategory(c)}
              className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-colors ${category === c ? "bg-orange-500 text-white border-orange-500" : "bg-white text-gray-600 border-gray-200"}`}>
              {c}
            </button>
          ))}
        </div>
      </div>

      <Field label="Serving name">
        <input type="text" value={servingName} onChange={(e) => setServingName(e.target.value)} className={INPUT} placeholder="e.g. 1 bowl, 1 slice" />
      </Field>

      <div className="text-sm font-semibold text-gray-500 uppercase tracking-wide pt-1">Nutrition per serving</div>
      <Field label="Calories" required unit="kcal">
        <input type="number" min="0" value={cals} onChange={(e) => setCals(e.target.value)} className={INPUT + " pr-12"} placeholder="Required" />
      </Field>
      {([
        { label: "Protein", u: "g", val: protein, set: setProtein },
        { label: "Carbohydrates", u: "g", val: carbs, set: setCarbs },
        { label: "Fibre", u: "g", val: fibre, set: setFibre },
        { label: "Fat", u: "g", val: fat, set: setFat },
      ]).map(({ label, u, val, set }) => (
        <Field key={label} label={label} unit={u}>
          <input type="number" min="0" value={val} onChange={(e) => set(e.target.value)} className={INPUT + " pr-8"} placeholder="Optional" />
        </Field>
      ))}

      <WhoSelector whoAte={whoAte} setWhoAte={setWhoAte} allMembers={allMembers} />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Save this food?</label>
        <div className="space-y-2">
          {([
            {v:"once",      label:"Add once",               desc:"Don't save"},
            {v:"mine",      label:"Save to My Foods",       desc:"Visible only to you"},
            {v:"household", label:"Save as Household Food", desc:"Visible to everyone"},
          ] as {v:string;label:string;desc:string}[]).map(({v,label,desc}) => (
            <button key={v} onClick={() => setSaveMode(v as typeof saveMode)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors text-left ${saveMode === v ? "border-orange-400 bg-orange-50" : "border-gray-100 bg-white"}`}>
              <div>
                <div className="text-sm font-medium text-gray-800">{label}</div>
                <div className="text-xs text-gray-400">{desc}</div>
              </div>
              {saveMode === v && <Check className="w-4 h-4 text-orange-500" />}
            </button>
          ))}
        </div>
      </div>

      <button onClick={handleAdd} disabled={!canSubmit || saving}
        className="w-full py-4 rounded-2xl bg-orange-500 text-white font-semibold text-base disabled:opacity-40">
        {saving ? "Saving…" : `Add to ${meal}`}
      </button>
    </div>
  );
}

// ─── Quick mode ───────────────────────────────────────────────────────────────

function QuickMode({ meal, member, allMembers, onAdded }: {
  meal:MealType; member:Member; allMembers:Member[]; onAdded:()=>void;
}) {
  const { addFood } = useAppStore();
  const [description, setDescription] = useState("");
  const [cals, setCals]       = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs]     = useState("");
  const [fibre, setFibre]     = useState("");
  const [fat, setFat]         = useState("");
  const [serving, setServing] = useState("1 serving");
  const [whoAte, setWhoAte]   = useState<WhoAte>(member.id);

  const calories  = parseFloat(cals) || 0;
  const canSubmit = description.trim().length > 0 && calories > 0;

  function handleAdd() {
    if (!canSubmit) return;
    const nutrition: Nutrition = {
      calories,
      protein:  parseFloat(protein) || 0,
      carbs:    parseFloat(carbs)   || 0,
      fibre:    parseFloat(fibre)   || 0,
      fat:      parseFloat(fat)     || 0,
    };
    const foodItem: FoodItem = {
      id: uuidv4(), name: description.trim(), category: "Basic Foods",
      baseNutrition: nutrition, unit: serving, source: "quick",
    };
    const targets = whoAte === "both" ? allMembers : allMembers.filter((m) => m.id === whoAte);
    for (const m of targets) {
      addFood({
        id: uuidv4(), foodItem, memberId: m.id, meal,
        servingQty: 1, servingUnit: serving,
        portion: serving, nutrition,
        timestamp: new Date().toISOString(), entryType: "quick",
        isQuickEntry: true, quickDescription: description.trim(),
      });
    }
    onAdded();
  }

  return (
    <div className="px-4 py-4 space-y-4 pb-8">
      <div className="bg-amber-50 rounded-2xl px-4 py-3 flex items-start gap-2">
        <Zap className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-amber-700"><strong>Manually entered estimate</strong> — use this when you don&apos;t know the exact nutrition details.</p>
      </div>

      <Field label="Description" required>
        <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
          className={INPUT} placeholder="e.g. Home-cooked dal rice" autoFocus />
      </Field>

      <Field label="Calories" required unit="kcal">
        <input type="number" min="0" value={cals} onChange={(e) => setCals(e.target.value)}
          className={INPUT + " pr-12"} placeholder="e.g. 450" />
      </Field>

      <Field label="Quantity / serving">
        <input type="text" value={serving} onChange={(e) => setServing(e.target.value)}
          className={INPUT} placeholder="e.g. 1 plate, 1 bowl" />
      </Field>

      <div className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Optional nutrients</div>
      {([
        { label: "Protein", u: "g", val: protein, set: setProtein },
        { label: "Carbohydrates", u: "g", val: carbs, set: setCarbs },
        { label: "Fibre", u: "g", val: fibre, set: setFibre },
        { label: "Fat", u: "g", val: fat, set: setFat },
      ]).map(({ label, u, val, set }) => (
        <div key={label} className="relative">
          <input type="number" min="0" value={val} onChange={(e) => set(e.target.value)}
            className={INPUT + " pr-8"} placeholder={label} />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{u}</span>
        </div>
      ))}

      <WhoSelector whoAte={whoAte} setWhoAte={setWhoAte} allMembers={allMembers} />

      <button onClick={handleAdd} disabled={!canSubmit}
        className="w-full py-4 rounded-2xl bg-amber-500 text-white font-semibold text-base disabled:opacity-40">
        Add estimate to {meal}
      </button>
    </div>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

const INPUT = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-400 text-gray-900 bg-white";

function Field({ label, required, unit, children }: {
  label:string; required?:boolean; unit?:string; children:React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-orange-500">*</span>}
      </label>
      <div className="relative">
        {children}
        {unit && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">{unit}</span>}
      </div>
    </div>
  );
}

function WhoSelector({ whoAte, setWhoAte, allMembers }: {
  whoAte:WhoAte; setWhoAte:(v:WhoAte)=>void; allMembers:Member[];
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">Log for</label>
      <div className="flex gap-2">
        {allMembers.map((m) => {
          const c = getMemberColors(m.avatarColor);
          return (
            <button key={m.id} onClick={() => setWhoAte(m.id)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${whoAte === m.id ? `${c.bg} text-white ${c.border}` : "bg-white text-gray-600 border-gray-200"}`}>
              {m.name}
            </button>
          );
        })}
        <button onClick={() => setWhoAte("both")}
          className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${whoAte === "both" ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200"}`}>
          Both
        </button>
      </div>
    </div>
  );
}
