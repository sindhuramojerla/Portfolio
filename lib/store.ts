"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  CustomFoodItem,
  DayLog,
  HouseholdConfig,
  LoggedFood,
  MealLog,
  MealType,
  Member,
  Nutrition,
} from "./types";
import { MEALS } from "./foods";
import {
  upsertHousehold,
  upsertDayLog,
  fetchDayLog,
  fetchHouseholdByCode,
  fetchCustomFoods,
  insertCustomFood,
  generateJoinCode,
} from "./supabase";

// ─── helpers ─────────────────────────────────────────────────────────────────

export function todayKey(): string {
  return new Date().toISOString().split("T")[0];
}

export function emptyMealLog(meal: MealType): MealLog {
  return { meal, foodsByMember: {}, doneByMember: {} };
}

export function emptyDayForDate(date: string): DayLog {
  return {
    date,
    meals: {
      Breakfast: emptyMealLog("Breakfast"),
      Lunch:     emptyMealLog("Lunch"),
      Dinner:    emptyMealLog("Dinner"),
      Snacks:    emptyMealLog("Snacks"),
    },
  };
}

export function emptyDay(): DayLog { return emptyDayForDate(todayKey()); }

export function sumNutrition(foods: LoggedFood[]): Nutrition {
  return foods.reduce(
    (acc, f) => ({
      calories: acc.calories + f.nutrition.calories,
      protein:  acc.protein  + f.nutrition.protein,
      carbs:    acc.carbs    + f.nutrition.carbs,
      fibre:    acc.fibre    + f.nutrition.fibre,
      fat:      acc.fat      + f.nutrition.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fibre: 0, fat: 0 }
  );
}

const DEV_HOUSEHOLD: HouseholdConfig = {
  householdName: "Our Household",
  onboardingComplete: false,
  householdId: "",
  joinCode: "",
  members: [
    { id: "member-1", name: "Member 1", initials: "M1", avatarColor: "bg-orange-400",
      goals: { calories: 2000, protein: 100, carbs: 200, fibre: 25, fat: 60 } },
    { id: "member-2", name: "Member 2", initials: "M2", avatarColor: "bg-rose-400",
      goals: { calories: 1800, protein: 90,  carbs: 180, fibre: 25, fat: 55 } },
  ],
};

// ─── state shape ─────────────────────────────────────────────────────────────

interface SyncState {
  syncing: boolean;
  lastSyncedAt: string | null;
  syncError: string | null;
}

interface AppState {
  household: HouseholdConfig;

  // ── date navigation ──────────────────────────────────────────────────────
  selectedDate: string;
  dayLogsCache: Record<string, DayLog>; // keyed by "YYYY-MM-DD"

  // dayLog is always dayLogsCache[selectedDate]
  dayLog: DayLog;

  // ── custom foods ─────────────────────────────────────────────────────────
  customFoods: CustomFoodItem[];
  recentFoodIds: string[];   // food IDs used recently (up to 20)

  // ── ui state ─────────────────────────────────────────────────────────────
  sync: SyncState;
  activeLoggingMeal: MealType | null;
  activeLoggingMemberId: string | null;
  showSummary: boolean;

  // ── household ────────────────────────────────────────────────────────────
  saveHousehold: (config: HouseholdConfig) => Promise<void>;
  joinHousehold: (code: string) => Promise<{ success: boolean; error?: string }>;
  updateMember: (member: Member) => Promise<void>;

  // ── date navigation ──────────────────────────────────────────────────────
  setSelectedDate: (date: string) => Promise<void>;
  goToPrevDay: () => Promise<void>;
  goToNextDay: () => Promise<void>;
  goToToday: () => Promise<void>;

  // ── food logging (operate on selectedDate) ───────────────────────────────
  addFood: (food: LoggedFood) => void;
  removeFood: (foodId: string, meal: MealType, memberId: string) => void;
  editFood: (foodId: string, meal: MealType, memberId: string, updates: Partial<LoggedFood>) => void;
  markMemberDone: (meal: MealType, memberId: string) => void;
  unmarkMemberDone: (meal: MealType, memberId: string) => void;
  startLogging: (meal: MealType, memberId: string) => void;
  stopLogging: () => void;

  // ── custom foods ─────────────────────────────────────────────────────────
  addCustomFood: (food: Omit<CustomFoodItem, "id" | "createdAt">) => Promise<CustomFoodItem>;
  loadCustomFoods: () => Promise<void>;
  trackRecentFood: (foodId: string) => void;

  // ── derived reads ─────────────────────────────────────────────────────────
  getMemberFoodsForMeal: (meal: MealType, memberId: string, date?: string) => LoggedFood[];
  getMealNutrition: (meal: MealType, memberId: string, date?: string) => Nutrition;
  getMemberNutrition: (memberId: string, date?: string) => Nutrition;

  // ── summary ───────────────────────────────────────────────────────────────
  setShowSummary: (v: boolean) => void;

  // ── sync ──────────────────────────────────────────────────────────────────
  pullLatest: (date?: string) => Promise<void>;
  resetDay: () => void;
}

// ─── store ───────────────────────────────────────────────────────────────────

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => {

      // ── internal sync helpers ───────────────────────────────────────────

      async function pushDayLog(dayLog: DayLog) {
        const { household } = get();
        if (!household.householdId) return;
        try {
          await upsertDayLog(household.householdId, dayLog.date, dayLog.meals);
          set((s) => ({ sync: { ...s.sync, lastSyncedAt: new Date().toISOString(), syncError: null } }));
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : "Sync failed";
          set((s) => ({ sync: { ...s.sync, syncError: msg } }));
        }
      }

      async function pushHousehold(config: HouseholdConfig) {
        if (!config.householdId) return;
        try { await upsertHousehold(config.householdId, config.joinCode, config); }
        catch { /* silent */ }
      }

      /** Mutate the dayLog for `selectedDate` then push */
      function mutateDayLog(updater: (day: DayLog) => DayLog) {
        set((state) => {
          const date = state.selectedDate;
          const current = state.dayLogsCache[date] ?? emptyDayForDate(date);
          const next = updater({ ...current });
          pushDayLog(next);
          return {
            dayLog: next,
            dayLogsCache: { ...state.dayLogsCache, [date]: next },
          };
        });
      }

      async function loadDateFromSupabase(date: string) {
        const { household } = get();
        if (!household.householdId) return;
        const meals = await fetchDayLog(household.householdId, date);
        if (meals) {
          const day: DayLog = { date, meals: meals as DayLog["meals"] };
          set((s) => ({
            dayLogsCache: { ...s.dayLogsCache, [date]: day },
            ...(s.selectedDate === date ? { dayLog: day } : {}),
          }));
        }
      }

      return {
        household: DEV_HOUSEHOLD,
        selectedDate: todayKey(),
        dayLogsCache: {},
        dayLog: emptyDay(),
        customFoods: [],
        recentFoodIds: [],
        sync: { syncing: false, lastSyncedAt: null, syncError: null },
        activeLoggingMeal: null,
        activeLoggingMemberId: null,
        showSummary: false,

        // ── household ────────────────────────────────────────────────────
        saveHousehold: async (config) => {
          set({ household: config });
          await pushHousehold(config);
        },

        joinHousehold: async (joinCode) => {
          set((s) => ({ sync: { ...s.sync, syncing: true, syncError: null } }));
          try {
            const row = await fetchHouseholdByCode(joinCode);
            if (!row) {
              set((s) => ({ sync: { ...s.sync, syncing: false } }));
              return { success: false, error: "No household found with that code." };
            }
            const config = row.config as HouseholdConfig;
            const meals = await fetchDayLog(row.id, todayKey());
            const dayLog = meals
              ? { date: todayKey(), meals: meals as DayLog["meals"] }
              : emptyDay();
            set({
              household: config,
              dayLog,
              dayLogsCache: { [todayKey()]: dayLog },
              selectedDate: todayKey(),
              sync: { syncing: false, lastSyncedAt: new Date().toISOString(), syncError: null },
            });
            return { success: true };
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Failed to join";
            set((s) => ({ sync: { ...s.sync, syncing: false, syncError: msg } }));
            return { success: false, error: msg };
          }
        },

        updateMember: async (member) => {
          const updated = {
            ...get().household,
            members: get().household.members.map((m) => m.id === member.id ? member : m),
          };
          set({ household: updated });
          await pushHousehold(updated);
        },

        // ── date navigation ──────────────────────────────────────────────
        setSelectedDate: async (date) => {
          const { dayLogsCache } = get();
          const cached = dayLogsCache[date];
          const dayLog = cached ?? emptyDayForDate(date);
          set({ selectedDate: date, dayLog });
          if (!cached) await loadDateFromSupabase(date);
        },

        goToPrevDay: async () => {
          const { selectedDate } = get();
          const d = new Date(selectedDate);
          d.setDate(d.getDate() - 1);
          await get().setSelectedDate(d.toISOString().split("T")[0]);
        },

        goToNextDay: async () => {
          const { selectedDate } = get();
          const today = todayKey();
          if (selectedDate >= today) return; // can't go to future
          const d = new Date(selectedDate);
          d.setDate(d.getDate() + 1);
          await get().setSelectedDate(d.toISOString().split("T")[0]);
        },

        goToToday: async () => {
          await get().setSelectedDate(todayKey());
        },

        // ── food logging ─────────────────────────────────────────────────
        addFood: (food) => {
          // deduplicate: if exact same id already exists, skip
          const { dayLog } = get();
          const existing = dayLog.meals[food.meal].foodsByMember[food.memberId] ?? [];
          if (existing.find((f) => f.id === food.id)) return;

          mutateDayLog((day) => {
            const meal = { ...day.meals[food.meal] };
            const prev = meal.foodsByMember[food.memberId] ?? [];
            meal.foodsByMember = { ...meal.foodsByMember, [food.memberId]: [...prev, food] };
            return { ...day, meals: { ...day.meals, [food.meal]: meal } };
          });

          // Track recently used food
          if (!food.isQuickEntry) get().trackRecentFood(food.foodItem.id);
        },

        removeFood: (foodId, meal, memberId) => {
          mutateDayLog((day) => {
            const m = { ...day.meals[meal] };
            m.foodsByMember = {
              ...m.foodsByMember,
              [memberId]: (m.foodsByMember[memberId] ?? []).filter((f) => f.id !== foodId),
            };
            return { ...day, meals: { ...day.meals, [meal]: m } };
          });
        },

        editFood: (foodId, meal, memberId, updates) => {
          mutateDayLog((day) => {
            const m = { ...day.meals[meal] };
            m.foodsByMember = {
              ...m.foodsByMember,
              [memberId]: (m.foodsByMember[memberId] ?? []).map((f) =>
                f.id === foodId ? { ...f, ...updates } : f
              ),
            };
            return { ...day, meals: { ...day.meals, [meal]: m } };
          });
        },

        markMemberDone: (meal, memberId) => {
          mutateDayLog((day) => {
            const m = { ...day.meals[meal] };
            m.doneByMember = { ...m.doneByMember, [memberId]: true };
            return { ...day, meals: { ...day.meals, [meal]: m } };
          });
        },

        unmarkMemberDone: (meal, memberId) => {
          mutateDayLog((day) => {
            const m = { ...day.meals[meal] };
            m.doneByMember = { ...m.doneByMember, [memberId]: false };
            return { ...day, meals: { ...day.meals, [meal]: m } };
          });
        },

        startLogging: (meal, memberId) =>
          set({ activeLoggingMeal: meal, activeLoggingMemberId: memberId }),

        stopLogging: () =>
          set({ activeLoggingMeal: null, activeLoggingMemberId: null }),

        // ── custom foods ─────────────────────────────────────────────────
        addCustomFood: async (food) => {
          const { id, createdAt } = await insertCustomFood(food);
          const full: CustomFoodItem = { ...food, id, createdAt };
          set((s) => ({ customFoods: [...s.customFoods, full] }));
          return full;
        },

        loadCustomFoods: async () => {
          const { household } = get();
          if (!household.householdId) return;
          const memberId = household.members[0]?.id ?? "";
          const foods = await fetchCustomFoods(household.householdId, memberId);
          set({ customFoods: foods });
        },

        trackRecentFood: (foodId) => {
          set((s) => {
            const ids = [foodId, ...s.recentFoodIds.filter((id) => id !== foodId)].slice(0, 20);
            return { recentFoodIds: ids };
          });
        },

        // ── derived reads ─────────────────────────────────────────────────
        getMemberFoodsForMeal: (meal, memberId, date) => {
          const { dayLog, dayLogsCache, selectedDate } = get();
          const d = date ?? selectedDate;
          const log = d === selectedDate ? dayLog : (dayLogsCache[d] ?? emptyDayForDate(d));
          return log.meals[meal].foodsByMember[memberId] ?? [];
        },

        getMealNutrition: (meal, memberId, date) =>
          sumNutrition(get().getMemberFoodsForMeal(meal, memberId, date)),

        getMemberNutrition: (memberId, date) => {
          const { dayLog, dayLogsCache, selectedDate } = get();
          const d = date ?? selectedDate;
          const log = d === selectedDate ? dayLog : (dayLogsCache[d] ?? emptyDayForDate(d));
          const allFoods = MEALS.flatMap((m) => log.meals[m].foodsByMember[memberId] ?? []);
          return sumNutrition(allFoods);
        },

        // ── summary ──────────────────────────────────────────────────────
        setShowSummary: (v) => set({ showSummary: v }),

        // ── sync ─────────────────────────────────────────────────────────
        pullLatest: async (date) => {
          const { household, selectedDate } = get();
          if (!household.householdId) return;
          const target = date ?? selectedDate;
          set((s) => ({ sync: { ...s.sync, syncing: true } }));
          try {
            const meals = await fetchDayLog(household.householdId, target);
            if (meals) {
              const day: DayLog = { date: target, meals: meals as DayLog["meals"] };
              set((s) => ({
                dayLogsCache: { ...s.dayLogsCache, [target]: day },
                ...(s.selectedDate === target ? { dayLog: day } : {}),
              }));
            }
            set((s) => ({ sync: { ...s.sync, syncing: false, lastSyncedAt: new Date().toISOString(), syncError: null } }));
          } catch {
            set((s) => ({ sync: { ...s.sync, syncing: false } }));
          }
        },

        resetDay: () => {
          const { selectedDate } = get();
          const day = emptyDayForDate(selectedDate);
          set((s) => ({
            dayLog: day,
            dayLogsCache: { ...s.dayLogsCache, [selectedDate]: day },
          }));
          pushDayLog(day);
        },
      };
    },
    {
      name: "homeplate-store-v4",
      // Don't persist the full cache — just today + household
      partialize: (s) => ({
        household: s.household,
        selectedDate: s.selectedDate,
        dayLog: s.dayLog,
        customFoods: s.customFoods,
        recentFoodIds: s.recentFoodIds,
        dayLogsCache: s.dayLogsCache,
      }),
    }
  )
);

export { MEALS };
export { generateJoinCode };
