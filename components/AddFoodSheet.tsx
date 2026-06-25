"use client";

import { useState, useMemo } from "react";
import {
  MealType, Member, FoodItem, FoodCategory,
  OilLevel, PortionSize, CustomFoodItem, Nutrition, LoggedFood,
} from "@/lib/types";
import { FOODS, PORTIONS, calculateNutrition, ADDED_INGREDIENTS } from "@/lib/foods";
import { useAppStore } from "@/lib/store";
import {
  X, ChevronLeft, Search, Plus, Zap, BookOpen,
  ChevronRight, Check,
} from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { getMemberColors } from "@/lib/colors";

// ─── types ────────────────────────────────────────────────────────────────────

interface Props {
  meal: MealType;
  member: Member;       // the member who opened the sheet
  allMembers: Member[];
  onClose: () => void;
  onAdded: () => void;  // called after each add (keeps sheet open)
  onDone: () => void;   // close sheet & mark done
}

type Mode = "pick" | "search" | "create" | "quick";
type WhoAte = string | "both"; // memberId or "both"

type SearchStep = "list" | "who-ate" | "detail" | "both-portions";

const PORTION_OPTIONS: PortionSize[] = ["½ katori", "1 katori", "1½ katoris", "2 katoris", "Custom"];

const EMPTY_NUTRITION: Nutrition = { calories: 0, protein: 0, carbs: 0, fibre: 0, fat: 0 };

// ─── helpers ─────────────────────────────────────────────────────────────────

function getMultiplier(p: PortionSize | string, custom: string): number {
  return p === "Custom" ? (parseFloat(custom) || 1) : (PORTIONS[p as PortionSize] ?? 1);
}

function customToFoodItem(c: CustomFoodItem): FoodItem {
  return {
    id: c.id,
    name: c.name,
    category: c.category,
    baseNutrition: c.nutrition,
    unit: c.servingName,
    source: "custom",
  };
}

// ─── main component ───────────────────────────────────────────────────────────

export default function AddFoodSheet({ meal, member, allMembers, onClose, onAdded, onDone }: Props) {
  const { addFood, customFoods, addCustomFood, recentFoodIds, getMemberFoodsForMeal } = useAppStore();
  const [mode, setMode] = useState<Mode>("pick");

  const existingFoods = getMemberFoodsForMeal(meal, member.id);

  function handleBack() {
    setMode("pick");
  }

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100 flex-shrink-0">
        {mode !== "pick" ? (
          <button onClick={handleBack} className="p-2 rounded-xl hover:bg-gray-100">
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

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {mode === "pick" && (
          <PickMode
            member={member}
            onSearch={() => setMode("search")}
            onCreate={() => setMode("create")}
            onQuick={() => setMode("quick")}
            onDone={onDone}
            existingCount={existingFoods.length}
          />
        )}

        {mode === "search" && (
          <SearchMode
            meal={meal}
            member={member}
            allMembers={allMembers}
            customFoods={customFoods}
            recentFoodIds={recentFoodIds}
            onAdded={() => { onAdded(); setMode("pick"); }}
            onCreateNew={() => setMode("create")}
          />
        )}

        {mode === "create" && (
          <CreateMode
            meal={meal}
            member={member}
            allMembers={allMembers}
            onAdded={() => { onAdded(); setMode("pick"); }}
          />
        )}

        {mode === "quick" && (
          <QuickMode
            meal={meal}
            member={member}
            allMembers={allMembers}
            onAdded={() => { onAdded(); setMode("pick"); }}
          />
        )}
      </div>
    </div>
  );
}

// ─── Pick mode ────────────────────────────────────────────────────────────────

function PickMode({ member, onSearch, onCreate, onQuick, onDone, existingCount }: {
  member: Member;
  onSearch: () => void;
  onCreate: () => void;
  onQuick: () => void;
  onDone: () => void;
  existingCount: number;
}) {
  return (
    <div className="px-4 py-6 space-y-3">
      <PickCard
        icon={<Search className="w-5 h-5 text-orange-600" />}
        bg="bg-orange-50"
        title="Search Foods"
        desc="Browse homemade, basic, packaged & saved foods"
        onClick={onSearch}
      />
      <PickCard
        icon={<Plus className="w-5 h-5 text-violet-600" />}
        bg="bg-violet-50"
        title="Create New Food"
        desc="Add a custom food and optionally save it"
        onClick={onCreate}
      />
      <PickCard
        icon={<Zap className="w-5 h-5 text-amber-600" />}
        bg="bg-amber-50"
        title="Quick Calorie Entry"
        desc="Estimate calories when you don't know full details"
        onClick={onQuick}
      />

      {existingCount > 0 && (
        <button
          onClick={onDone}
          className="w-full mt-4 py-4 rounded-2xl bg-gray-900 text-white font-semibold text-base"
        >
          Done — close log
        </button>
      )}
    </div>
  );
}

function PickCard({ icon, bg, title, desc, onClick }: {
  icon: React.ReactNode; bg: string; title: string; desc: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 px-4 py-4 bg-white rounded-2xl border border-gray-100 shadow-sm text-left active:bg-gray-50 transition-colors"
    >
      <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
        {icon}
      </div>
      <div className="flex-1">
        <div className="font-semibold text-gray-800">{title}</div>
        <div className="text-xs text-gray-400 mt-0.5">{desc}</div>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-300" />
    </button>
  );
}

// ─── Search mode ──────────────────────────────────────────────────────────────

function SearchMode({ meal, member, allMembers, customFoods, recentFoodIds, onAdded, onCreateNew }: {
  meal: MealType;
  member: Member;
  allMembers: Member[];
  customFoods: CustomFoodItem[];
  recentFoodIds: string[];
  onAdded: () => void;
  onCreateNew: () => void;
}) {
  const { addFood } = useAppStore();
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<FoodCategory | "All" | "Recent" | "Saved">("All");
  const [searchStep, setSearchStep] = useState<SearchStep>("list");
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [oilLevel, setOilLevel] = useState<OilLevel>("Normal");
  const [portion, setPortion] = useState<PortionSize>("1 katori");
  const [customMult, setCustomMult] = useState("1");
  const [addedIngs, setAddedIngs] = useState<string[]>([]);
  const [whoAte, setWhoAte] = useState<WhoAte>(member.id);
  const [memberPortions, setMemberPortions] = useState<Record<string, PortionSize>>(
    () => Object.fromEntries(allMembers.map((m) => [m.id, "1 katori" as PortionSize]))
  );
  const [memberCustoms, setMemberCustoms] = useState<Record<string, string>>(
    () => Object.fromEntries(allMembers.map((m) => [m.id, "1"]))
  );

  // Build combined food list
  const allFoods: FoodItem[] = useMemo(() => {
    const custom: FoodItem[] = customFoods.map(customToFoodItem);
    return [...FOODS, ...custom];
  }, [customFoods]);

  const recentFoods: FoodItem[] = useMemo(() =>
    recentFoodIds.flatMap((id) => allFoods.filter((f) => f.id === id)).slice(0, 6),
    [recentFoodIds, allFoods]
  );

  const filtered = useMemo(() => {
    if (activeCategory === "Recent") return recentFoods.filter((f) => f.name.toLowerCase().includes(query.toLowerCase()));
    if (activeCategory === "Saved")  return allFoods.filter((f) => f.source === "custom" && f.name.toLowerCase().includes(query.toLowerCase()));
    return allFoods.filter((f) => {
      const matchCat = activeCategory === "All" || f.category === activeCategory;
      const matchQ   = f.name.toLowerCase().includes(query.toLowerCase());
      return matchCat && matchQ;
    });
  }, [allFoods, recentFoods, activeCategory, query]);

  const liveNutrition = useMemo(() => {
    if (!selectedFood || searchStep !== "detail" || whoAte === "both") return null;
    return calculateNutrition(
      selectedFood,
      getMultiplier(portion, customMult),
      selectedFood.category === "Homemade" ? oilLevel : undefined,
      selectedFood.category === "Homemade" ? addedIngs : undefined
    );
  }, [selectedFood, searchStep, whoAte, portion, customMult, oilLevel, addedIngs]);

  function selectFood(food: FoodItem) {
    setSelectedFood(food);
    setSearchStep(food.category === "Homemade" ? "who-ate" : "detail");
  }

  function doLog() {
    if (!selectedFood) return;
    if (whoAte === "both") {
      for (const m of allMembers) {
        const p = memberPortions[m.id];
        const nutr = calculateNutrition(selectedFood, getMultiplier(p, memberCustoms[m.id]), oilLevel, addedIngs);
        addFood({
          id: uuidv4(), foodItem: selectedFood, memberId: m.id, meal,
          portion: p,
          customPortionMultiplier: p === "Custom" ? parseFloat(memberCustoms[m.id]) : undefined,
          oilLevel, addedIngredients: addedIngs, nutrition: nutr,
          timestamp: new Date().toISOString(), entryType: "search",
        });
      }
    } else {
      const nutr = calculateNutrition(
        selectedFood, getMultiplier(portion, customMult),
        selectedFood.category === "Homemade" ? oilLevel : undefined,
        selectedFood.category === "Homemade" ? addedIngs : undefined
      );
      addFood({
        id: uuidv4(), foodItem: selectedFood, memberId: whoAte, meal,
        portion,
        customPortionMultiplier: portion === "Custom" ? parseFloat(customMult) : undefined,
        oilLevel: selectedFood.category === "Homemade" ? oilLevel : undefined,
        addedIngredients: selectedFood.category === "Homemade" ? addedIngs : undefined,
        nutrition: nutr, timestamp: new Date().toISOString(), entryType: "search",
      });
    }
    onAdded();
  }

  const mc = getMemberColors(member.avatarColor);
  const memberTextColor = mc.text;
  const memberLight = mc.light;

  // ── render steps ──

  if (searchStep === "who-ate" && selectedFood) {
    return (
      <div className="px-4 py-6 space-y-4">
        <div>
          <div className="text-lg font-bold text-gray-800">{selectedFood.name}</div>
          <div className="text-sm text-gray-400 mt-0.5">Who ate this?</div>
        </div>
        {allMembers.map((m) => (
          <button key={m.id}
            onClick={() => { setWhoAte(m.id); setSearchStep("detail"); }}
            className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl bg-gray-50 active:bg-gray-100 transition-colors text-left"
          >
            <div className={`w-8 h-8 rounded-full ${m.avatarColor} flex items-center justify-center text-white text-xs font-bold`}>{m.initials}</div>
            <span className="text-base font-medium text-gray-800">{m.name}</span>
          </button>
        ))}
        <button
          onClick={() => { setWhoAte("both"); setSearchStep("detail"); }}
          className="w-full flex items-center justify-between px-4 py-4 rounded-2xl bg-gray-50 active:bg-gray-100 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-8">
              {allMembers.slice(0, 2).map((m, i) => (
                <div key={m.id} className={`absolute w-8 h-8 rounded-full ${m.avatarColor} flex items-center justify-center text-white text-xs font-bold border-2 border-white`} style={{ left: i * 12 }}>
                  {m.initials[0]}
                </div>
              ))}
            </div>
            <span className="text-base font-medium text-gray-800">Both</span>
          </div>
          <span className="text-xs text-gray-400">Set portions separately</span>
        </button>
      </div>
    );
  }

  if (searchStep === "detail" && selectedFood) {
    return (
      <div className="px-4 py-4 space-y-5">
        <div>
          <div className="text-lg font-bold text-gray-800">{selectedFood.name}</div>
          {whoAte === "both" && <div className="text-sm text-orange-500 font-medium mt-0.5">Shared dish</div>}
        </div>

        {selectedFood.category === "Homemade" && (
          <>
            <div className="space-y-2">
              <div className="text-sm font-semibold text-gray-700">Oil level</div>
              <div className="flex gap-2">
                {(["Less oily", "Normal", "More oily"] as OilLevel[]).map((o) => (
                  <button key={o} onClick={() => setOilLevel(o)}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${oilLevel === o ? "bg-orange-500 text-white border-orange-500" : "bg-white text-gray-600 border-gray-200"}`}>
                    {o}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-semibold text-gray-700">Added ingredients <span className="font-normal text-gray-400">(optional)</span></div>
              <div className="flex flex-wrap gap-2">
                {ADDED_INGREDIENTS.map((ing) => (
                  <button key={ing.name}
                    onClick={() => setAddedIngs((p) => p.includes(ing.name) ? p.filter((i) => i !== ing.name) : [...p, ing.name])}
                    className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors ${addedIngs.includes(ing.name) ? "bg-orange-500 text-white border-orange-500" : "bg-white text-gray-600 border-gray-200"}`}>
                    {ing.name}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {whoAte !== "both" ? (
          <>
            <div className="space-y-2">
              <div className="text-sm font-semibold text-gray-700">Portion</div>
              <div className="grid grid-cols-2 gap-2">
                {PORTION_OPTIONS.map((p) => (
                  <button key={p} onClick={() => setPortion(p)}
                    className={`py-3 rounded-xl text-sm font-medium border transition-colors ${portion === p ? "bg-orange-500 text-white border-orange-500" : "bg-white text-gray-600 border-gray-200"}`}>
                    {p}
                  </button>
                ))}
              </div>
              {portion === "Custom" && (
                <input type="number" step="0.5" min="0.1" value={customMult} onChange={(e) => setCustomMult(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-400" placeholder="Multiplier" />
              )}
            </div>
            {liveNutrition && (
              <div className={`${memberLight} rounded-2xl p-4 space-y-2`}>
                <div className={`text-xs font-semibold uppercase tracking-wide ${memberTextColor}`}>Nutrition preview</div>
                <div className="flex items-end gap-1">
                  <span className={`text-2xl font-bold ${memberTextColor}`}>{liveNutrition.calories}</span>
                  <span className={`text-sm mb-0.5 ${memberTextColor} opacity-70`}>kcal</span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  {[["Protein", liveNutrition.protein], ["Carbs", liveNutrition.carbs], ["Fibre", liveNutrition.fibre], ["Fat", liveNutrition.fat]].map(([l, v]) => (
                    <div key={l as string}>
                      <div className={`${memberTextColor} opacity-70`}>{l}</div>
                      <div className={`font-semibold ${memberTextColor}`}>{Math.round((v as number) * 10) / 10}g</div>
                    </div>
                  ))}
                </div>
                <div className={`text-xs ${memberTextColor} opacity-60`}>Approximate nutrition based on portion, oil level and selected ingredients.</div>
              </div>
            )}
            <div className="pb-4">
              <button onClick={doLog} className="w-full py-4 rounded-2xl bg-orange-500 text-white font-semibold text-base active:bg-orange-600">
                Add to {meal}
              </button>
            </div>
          </>
        ) : (
          <button onClick={() => setSearchStep("both-portions")} className="w-full py-3 rounded-2xl bg-orange-500 text-white font-semibold">
            Set portions for each person →
          </button>
        )}
      </div>
    );
  }

  if (searchStep === "both-portions" && selectedFood) {
    return (
      <div className="px-4 py-4 space-y-5">
        <div className="text-base font-bold text-gray-800">Set portions</div>
        {allMembers.map((m) => {
          const p    = memberPortions[m.id];
          const cust = memberCustoms[m.id];
          const preview = calculateNutrition(selectedFood, getMultiplier(p, cust), oilLevel, addedIngs).calories;
          return (
            <div key={m.id} className="space-y-2">
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full ${m.avatarColor} flex items-center justify-center text-white text-xs font-bold`}>{m.initials}</div>
                <span className="text-sm font-semibold text-gray-700">{m.name}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {PORTION_OPTIONS.map((po) => (
                  <button key={po} onClick={() => setMemberPortions((prev) => ({ ...prev, [m.id]: po }))}
                    className={`py-2.5 rounded-xl text-sm font-medium border transition-colors ${p === po ? `${getMemberColors(m.avatarColor).bg} text-white ${getMemberColors(m.avatarColor).border}` : "bg-white text-gray-600 border-gray-200"}`}>
                    {po}
                  </button>
                ))}
              </div>
              {p === "Custom" && (
                <input type="number" step="0.5" min="0.1" value={cust} onChange={(e) => setMemberCustoms((prev) => ({ ...prev, [m.id]: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm outline-none" placeholder="Multiplier" />
              )}
              <div className="text-xs text-gray-400">≈ {preview} kcal</div>
            </div>
          );
        })}
        <div className="bg-orange-50 rounded-2xl p-3 text-xs text-orange-400">
          Approximate nutrition based on portion, oil level and selected ingredients.
        </div>
        <button onClick={doLog} className="w-full py-4 rounded-2xl bg-orange-500 text-white font-semibold text-base active:bg-orange-600">
          Add to {meal}
        </button>
      </div>
    );
  }

  // ── food list ──
  return (
    <div className="px-4 py-4 space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input className="w-full pl-9 pr-4 py-3 bg-gray-100 rounded-2xl text-sm outline-none placeholder:text-gray-400"
          placeholder="Search foods…" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {(["All", "Recent", "Saved", "Homemade", "Basic Foods", "Packaged Foods"] as const).map((cat) => (
          <button key={cat} onClick={() => setActiveCategory(cat)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${activeCategory === cat ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600"}`}>
            {cat}
          </button>
        ))}
      </div>

      {/* Food list */}
      <div className="space-y-1">
        {filtered.map((food) => (
          <button key={food.id} onClick={() => selectFood(food)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-gray-50 active:bg-gray-100 text-left transition-colors">
            <div>
              <div className="text-sm font-medium text-gray-800">{food.name}</div>
              <div className="text-xs text-gray-400">
                {food.source === "custom" ? "Saved" : food.category} · per {food.unit}
              </div>
            </div>
            <div className="text-sm font-semibold text-gray-500">{food.baseNutrition.calories} kcal</div>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">No foods found</div>
        )}
      </div>

      {/* Create new prompt */}
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
  meal: MealType; member: Member; allMembers: Member[]; onAdded: () => void;
}) {
  const { addFood, addCustomFood, household } = useAppStore();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<FoodCategory>("Basic Foods");
  const [servingName, setServingName] = useState("1 serving");
  const [cals, setCals] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fibre, setFibre] = useState("");
  const [fat, setFat] = useState("");
  const [whoAte, setWhoAte] = useState<WhoAte>(member.id);
  const [saving, setSaving] = useState(false);
  const [saveMode, setSaveMode] = useState<"once" | "mine" | "household">("once");

  const calories = parseFloat(cals) || 0;
  const canSubmit = name.trim().length > 0 && calories > 0;

  const nutrition: Nutrition = {
    calories,
    protein:  parseFloat(protein)  || 0,
    carbs:    parseFloat(carbs)    || 0,
    fibre:    parseFloat(fibre)    || 0,
    fat:      parseFloat(fat)      || 0,
  };

  async function handleAdd() {
    if (!canSubmit || saving) return;
    setSaving(true);

    let foodItem: FoodItem = {
      id: uuidv4(), name: name.trim(), category, baseNutrition: nutrition,
      unit: servingName, source: "custom",
    };

    // If saving, persist to Supabase and get a real ID
    if (saveMode !== "once" && household.householdId) {
      try {
        const saved = await addCustomFood({
          householdId: household.householdId,
          createdByMemberId: member.id,
          name: name.trim(), category, servingName, nutrition,
          scope: saveMode === "household" ? "household" : "personal",
        });
        foodItem = { ...foodItem, id: saved.id };
      } catch { /* log anyway */ }
    }

    const members = whoAte === "both" ? allMembers : allMembers.filter((m) => m.id === whoAte);
    for (const m of members) {
      addFood({
        id: uuidv4(), foodItem, memberId: m.id, meal,
        portion: servingName, nutrition,
        timestamp: new Date().toISOString(), entryType: "search",
      });
    }
    setSaving(false);
    onAdded();
  }

  const InputField = ({ label, value, onChange, unit, required, type = "number" }: {
    label: string; value: string; onChange: (v: string) => void;
    unit?: string; required?: boolean; type?: string;
  }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-orange-500">*</span>}
      </label>
      <div className="relative">
        <input
          type={type} value={value} onChange={(e) => onChange(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-400 bg-white"
          placeholder={required ? "Required" : "Optional"}
        />
        {unit && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{unit}</span>}
      </div>
    </div>
  );

  return (
    <div className="px-4 py-4 space-y-4 pb-8">
      <div className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Food details</div>

      <InputField label="Food name" value={name} onChange={setName} required type="text" />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Food type</label>
        <div className="flex gap-2">
          {(["Homemade", "Basic Foods", "Packaged Foods"] as FoodCategory[]).map((c) => (
            <button key={c} onClick={() => setCategory(c)}
              className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-colors ${category === c ? "bg-orange-500 text-white border-orange-500" : "bg-white text-gray-600 border-gray-200"}`}>
              {c}
            </button>
          ))}
        </div>
      </div>

      <InputField label="Serving name" value={servingName} onChange={setServingName} type="text" />

      <div className="text-sm font-semibold text-gray-500 uppercase tracking-wide pt-1">Nutrition per serving</div>
      <InputField label="Calories" value={cals} onChange={setCals} unit="kcal" required />
      <InputField label="Protein" value={protein} onChange={setProtein} unit="g" />
      <InputField label="Carbohydrates" value={carbs} onChange={setCarbs} unit="g" />
      <InputField label="Fibre" value={fibre} onChange={setFibre} unit="g" />
      <InputField label="Fat" value={fat} onChange={setFat} unit="g" />

      {/* Who */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Log for</label>
        <div className="flex gap-2">
          {allMembers.map((m) => (
            <button key={m.id} onClick={() => setWhoAte(m.id)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${whoAte === m.id ? `${getMemberColors(m.avatarColor).bg} text-white ${getMemberColors(m.avatarColor).border}` : "bg-white text-gray-600 border-gray-200"}`}>
              {m.name}
            </button>
          ))}
          <button onClick={() => setWhoAte("both")}
            className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${whoAte === "both" ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200"}`}>
            Both
          </button>
        </div>
      </div>

      {/* Save options */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Save this food?</label>
        <div className="space-y-2">
          {([
            { v: "once",      label: "Add once",              desc: "Don't save" },
            { v: "mine",      label: "Save to My Foods",      desc: "Visible to you" },
            { v: "household", label: "Save as Household Food", desc: "Visible to everyone" },
          ] as { v: string; label: string; desc: string }[]).map(({ v, label, desc }) => (
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
  meal: MealType; member: Member; allMembers: Member[]; onAdded: () => void;
}) {
  const { addFood } = useAppStore();
  const [description, setDescription] = useState("");
  const [cals, setCals] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fibre, setFibre] = useState("");
  const [fat, setFat] = useState("");
  const [servingDesc, setServingDesc] = useState("1 serving");
  const [whoAte, setWhoAte] = useState<WhoAte>(member.id);

  const calories = parseFloat(cals) || 0;
  const canSubmit = description.trim().length > 0 && calories > 0;

  function handleAdd() {
    if (!canSubmit) return;
    const nutrition: Nutrition = {
      calories,
      protein:  parseFloat(protein)  || 0,
      carbs:    parseFloat(carbs)    || 0,
      fibre:    parseFloat(fibre)    || 0,
      fat:      parseFloat(fat)      || 0,
    };
    const foodItem: FoodItem = {
      id: uuidv4(), name: description.trim(), category: "Basic Foods",
      baseNutrition: nutrition, unit: servingDesc, source: "quick",
    };
    const members = whoAte === "both" ? allMembers : allMembers.filter((m) => m.id === whoAte);
    for (const m of members) {
      addFood({
        id: uuidv4(), foodItem, memberId: m.id, meal,
        portion: servingDesc, nutrition,
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
        <p className="text-xs text-amber-700">
          <strong>Manually entered estimate</strong> — use this when you don&apos;t know the exact nutrition details.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-orange-500">*</span></label>
        <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-400"
          placeholder="e.g. Home-cooked dal rice" autoFocus />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Calories <span className="text-orange-500">*</span></label>
        <div className="relative">
          <input type="number" min="0" value={cals} onChange={(e) => setCals(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 pr-14 text-sm outline-none focus:border-orange-400"
            placeholder="e.g. 450" />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">kcal</span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Quantity / serving <span className="text-gray-400 font-normal">(optional)</span></label>
        <input type="text" value={servingDesc} onChange={(e) => setServingDesc(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-400"
          placeholder="e.g. 1 plate, 1 bowl" />
      </div>

      <div className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Optional nutrients</div>

      {[
        { label: "Protein",       val: protein, set: setProtein },
        { label: "Carbohydrates", val: carbs,   set: setCarbs   },
        { label: "Fibre",         val: fibre,   set: setFibre   },
        { label: "Fat",           val: fat,     set: setFat     },
      ].map(({ label, val, set }) => (
        <div key={label} className="relative">
          <input type="number" min="0" value={val} onChange={(e) => set(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 pr-16 text-sm outline-none focus:border-orange-400"
            placeholder={label} />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">g</span>
        </div>
      ))}

      {/* Who */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Log for</label>
        <div className="flex gap-2">
          {allMembers.map((m) => (
            <button key={m.id} onClick={() => setWhoAte(m.id)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${whoAte === m.id ? `${getMemberColors(m.avatarColor).bg} text-white ${getMemberColors(m.avatarColor).border}` : "bg-white text-gray-600 border-gray-200"}`}>
              {m.name}
            </button>
          ))}
          <button onClick={() => setWhoAte("both")}
            className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${whoAte === "both" ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200"}`}>
            Both
          </button>
        </div>
      </div>

      <button onClick={handleAdd} disabled={!canSubmit}
        className="w-full py-4 rounded-2xl bg-amber-500 text-white font-semibold text-base disabled:opacity-40">
        Add estimate to {meal}
      </button>
    </div>
  );
}
