"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  CustomFoodItem,
  DayLog,
  HouseholdConfig,
  HouseholdFoodPref,
  KnownHousehold,
  LoggedFood,
  MealLog,
  MealType,
  Member,
  Nutrition,
  SupabaseFood,
} from "./types";
import { MEALS } from "./foods";
import {
  upsertHousehold,
  upsertDayLog,
  fetchDayLog,
  fetchFoods,
  fetchHouseholdFoodPrefs,
  fetchCustomFoods,
  insertCustomFood,
  generateJoinCode,
  joinHouseholdWithCode,
  fetchUserHouseholds,
  fetchAllHouseholds,
  claimHousehold,
  householdExistsInSupabase,
  supabase,
} from "./supabase";
import { onAuthStateChange, getCurrentSession, logout as authLogout } from "./auth";
import { v4 as uuidv4 } from "uuid";

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function todayKey(): string {
  return new Date().toISOString().split("T")[0];
}

function emptyMealLog(meal: MealType): MealLog {
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

// Device token system removed — using Supabase Auth instead

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

// ─── State shape ─────────────────────────────────────────────────────────────

interface SyncState {
  syncing: boolean;
  lastSyncedAt: string | null;
  syncError: string | null;
}

interface AppState {
  // ── Authentication ────────────────────────────────────────────────────────
  currentUserId: string | null;  // Current authenticated user's UID, null if logged out
  authInitialized: boolean;      // True once auth startup is complete
  authLoading: boolean;           // True while checking session

  // ── Household ─────────────────────────────────────────────────────────────
  household: HouseholdConfig;
  knownHouseholds: KnownHousehold[];  // all households this device has joined
  unclaimedHouseholds: Array<{ id: string; config: HouseholdConfig }>;  // existing households user doesn't own yet

  // ── Date navigation ───────────────────────────────────────────────────────
  selectedDate: string;
  dayLogsCache: Record<string, DayLog>;
  dayLog: DayLog;

  // ── Food catalogue ────────────────────────────────────────────────────────
  foods: SupabaseFood[];              // loaded from Supabase
  householdFoodPrefs: Record<string, HouseholdFoodPref>; // food_id → pref
  customFoods: CustomFoodItem[];      // legacy custom_foods table
  recentFoodCodes: string[];          // food_codes used recently (max 20)

  // ── UI state ──────────────────────────────────────────────────────────────
  sync: SyncState;
  activeLoggingMeal: MealType | null;
  activeLoggingMemberId: string | null;
  showSummary: boolean;

  // ── Household actions ─────────────────────────────────────────────────────
  saveHousehold: (config: HouseholdConfig) => Promise<void>;
  joinHousehold: (code: string) => Promise<{ success: boolean; error?: string }>;
  claimHousehold: (householdId: string) => Promise<{ success: boolean; error?: string }>;
  createAndSwitchHousehold: (config: HouseholdConfig) => Promise<void>;
  switchHousehold: (householdId: string) => Promise<void>;
  leaveHousehold: (householdId: string) => void;
  updateMember: (member: Member) => Promise<void>;

  // ── Date navigation ───────────────────────────────────────────────────────
  setSelectedDate: (date: string) => Promise<void>;
  goToPrevDay: () => Promise<void>;
  goToNextDay: () => Promise<void>;
  goToToday: () => Promise<void>;

  // ── Food logging ──────────────────────────────────────────────────────────
  addFood: (food: LoggedFood) => void;
  removeFood: (foodId: string, meal: MealType, memberId: string) => void;
  editFood: (foodId: string, meal: MealType, memberId: string, updates: Partial<LoggedFood>) => void;
  markMemberDone: (meal: MealType, memberId: string) => void;
  unmarkMemberDone: (meal: MealType, memberId: string) => void;
  startLogging: (meal: MealType, memberId: string) => void;
  stopLogging: () => void;

  // ── Food catalogue ────────────────────────────────────────────────────────
  loadFoods: () => Promise<void>;
  addCustomFood: (food: Omit<CustomFoodItem, "id" | "createdAt">) => Promise<CustomFoodItem>;
  trackRecentFood: (foodCode: string) => void;

  // ── Derived reads ─────────────────────────────────────────────────────────
  getMemberFoodsForMeal: (meal: MealType, memberId: string) => LoggedFood[];
  getMealNutrition: (meal: MealType, memberId: string) => Nutrition;
  getMemberNutrition: (memberId: string) => Nutrition;

  // ── Summary ───────────────────────────────────────────────────────────────
  setShowSummary: (v: boolean) => void;

  // ── Sync ──────────────────────────────────────────────────────────────────
  pullLatest: (date?: string) => Promise<void>;
  resetDay: () => void;

  // ── Auth ───────────────────────────────────────────────────────────────────
  initAuth: () => () => void;  // Set up auth state listener on app startup, returns cleanup fn
  setAuthLoading: (loading: boolean) => void;
  logout: () => Promise<void>;  // Sign out current user
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => {

      // ── Internal helpers ────────────────────────────────────────────────

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
        if (!config.householdId) {
          console.warn("No householdId to save");
          return;
        }
        try {
          console.log("Upserting household to database...");
          await upsertHousehold(config.householdId, config.joinCode, config);
          console.log("✅ Household upserted to database");
        } catch (err) {
          console.error("❌ Failed to upsert household:", err);
          throw err;
        }
      }

      /**
       * When a household is first created, add the current user to household_memberships.
       * This allows RLS policies to grant the user access to the household.
       * MUST be called AFTER household is saved to Supabase.
       */
      async function ensureUserInHousehold(householdId: string, userId: string) {
        try {
          console.log("👤 ensureUserInHousehold: Adding user to membership", {
            householdId: householdId.slice(0, 8) + "...",
            userId: userId.slice(0, 8) + "...",
          });

          // Step 1: Verify household exists first
          const { householdExistsInSupabase } = await import("./supabase");
          const exists = await householdExistsInSupabase(householdId);
          if (!exists) {
            throw new Error(
              `Household ${householdId} does not exist in Supabase. ` +
              `Must save household to database before adding membership.`
            );
          }
          console.log("✅ Household exists in Supabase");

          // Step 2: Insert membership
          const { data, error } = await supabase
            .from("household_memberships")
            .upsert(
              { household_id: householdId, member_id: userId },
              { onConflict: "household_id,member_id" }
            )
            .select();

          if (error) {
            console.error("❌ Membership insert failed:", {
              code: error.code,
              message: error.message,
              details: error.details,
              hint: error.hint,
            });
            throw error;
          }

          console.log("✅ User membership created");
        } catch (e) {
          console.error("❌ ensureUserInHousehold failed:", {
            error: e instanceof Error ? e.message : String(e),
            householdId: householdId.slice(0, 8) + "...",
          });
          throw e;
        }
      }

      function mutateDayLog(updater: (day: DayLog) => DayLog) {
        set((state) => {
          const date    = state.selectedDate;
          const current = state.dayLogsCache[date] ?? emptyDayForDate(date);
          const next    = updater({ ...current });
          pushDayLog(next);
          return {
            dayLog:       next,
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

      // Membership is now handled via Supabase Auth RPC (no device token tracking)

      return {
        currentUserId: null,
        authInitialized: false,
        authLoading: true,
        household: DEV_HOUSEHOLD,
        knownHouseholds: [],
        unclaimedHouseholds: [],
        selectedDate: todayKey(),
        dayLogsCache: {},
        dayLog: emptyDay(),
        foods: [],
        householdFoodPrefs: {},
        customFoods: [],
        recentFoodCodes: [],
        sync: { syncing: false, lastSyncedAt: null, syncError: null },
        activeLoggingMeal: null,
        activeLoggingMemberId: null,
        showSummary: false,

        // ── Household ──────────────────────────────────────────────────────

        saveHousehold: async (config) => {
          try {
            const userId = get().currentUserId;
            console.log("💾 saveHousehold START:", {
              householdId: config.householdId.slice(0, 8) + "...",
              name: config.householdName,
              authenticated: !!userId,
              userId: userId ? userId.slice(0, 8) + "..." : "NOT_AUTHENTICATED",
            });

            // CRITICAL: Verify user is authenticated
            if (!userId) {
              const errMsg = "Cannot create household: user not authenticated";
              console.error("❌ " + errMsg);
              throw new Error(errMsg);
            }

            // 1. Save household config to local state
            set({ household: config });

            // 2. Push to Supabase database
            console.log("📤 Pushing household to Supabase...");
            await pushHousehold(config);

            // 3. VERIFY household was actually saved
            console.log("🔍 Verifying household in Supabase...");
            const exists = await householdExistsInSupabase(config.householdId);
            if (!exists) {
              throw new Error(
                `Household was not saved to Supabase. ` +
                `Check RLS policies and database permissions.`
              );
            }
            console.log("✅ Household verified in Supabase");

            // 4. Add current user to household_memberships (CRITICAL for RLS)
            const userId = get().currentUserId;
            if (!userId) {
              console.warn("⚠️ No currentUserId available - user not authenticated");
            } else {
              console.log("👤 Adding user to household membership...");
              await ensureUserInHousehold(config.householdId, userId);
              console.log("✅ User membership created");
            }

            // 5. Track in knownHouseholds
            set((s) => {
              const entry: KnownHousehold = {
                householdId:  config.householdId,
                joinCode:     config.joinCode,
                householdName: config.householdName,
                memberCount:  config.members.length,
              };
              const others = s.knownHouseholds.filter(
                (h) => h.householdId !== config.householdId
              );
              return { knownHouseholds: [entry, ...others] };
            });

            console.log("✅ Household saved and linked successfully");
          } catch (err) {
            console.error("❌ saveHousehold failed:", err instanceof Error ? err.message : String(err));
            throw err;
          }
        },

        joinHousehold: async (joinCode) => {
          set((s) => ({ sync: { ...s.sync, syncing: true, syncError: null } }));
          try {
            // Call secure RPC to join household (adds to household_memberships)
            const result = await joinHouseholdWithCode(joinCode);
            if (!result.success || !result.householdId) {
              set((s) => ({ sync: { ...s.sync, syncing: false } }));
              return { success: false, error: result.error || "Failed to join household" };
            }

            // Fetch the household using RLS-protected query
            const households = await fetchUserHouseholds();
            const household = households.find((h) => h.id === result.householdId);
            if (!household) {
              set((s) => ({ sync: { ...s.sync, syncing: false } }));
              return { success: false, error: "Could not load household data" };
            }

            const config = household.config as HouseholdConfig;
            const meals  = await fetchDayLog(result.householdId, todayKey());
            const dayLog = meals
              ? { date: todayKey(), meals: meals as DayLog["meals"] }
              : emptyDay();

            const entry: KnownHousehold = {
              householdId:   result.householdId,
              joinCode:      household.joinCode ?? "",
              householdName: config.householdName,
              memberCount:   config.members.length,
            };

            set((s) => ({
              household:       config,
              dayLog,
              dayLogsCache:    { [todayKey()]: dayLog },
              selectedDate:    todayKey(),
              knownHouseholds: [
                entry,
                ...s.knownHouseholds.filter((h) => h.householdId !== result.householdId),
              ],
              sync: { syncing: false, lastSyncedAt: new Date().toISOString(), syncError: null },
            }));

            return { success: true };
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Failed to join";
            set((s) => ({ sync: { ...s.sync, syncing: false, syncError: msg } }));
            return { success: false, error: msg };
          }
        },

        claimHousehold: async (householdId) => {
          set((s) => ({ sync: { ...s.sync, syncing: true, syncError: null } }));
          try {
            // Claim the household (creates membership for auth.uid())
            const result = await claimHousehold(householdId);
            if (!result.success) {
              set((s) => ({ sync: { ...s.sync, syncing: false } }));
              return { success: false, error: result.error || "Failed to claim household" };
            }

            // Fetch the household using RLS-protected query
            const households = await fetchUserHouseholds();
            const household = households.find((h) => h.id === householdId);
            if (!household) {
              set((s) => ({ sync: { ...s.sync, syncing: false } }));
              return { success: false, error: "Could not load household data" };
            }

            const config = household.config as HouseholdConfig;
            const meals  = await fetchDayLog(householdId, todayKey());
            const dayLog = meals
              ? { date: todayKey(), meals: meals as DayLog["meals"] }
              : emptyDay();

            const entry: KnownHousehold = {
              householdId:   householdId,
              joinCode:      household.joinCode ?? "",
              householdName: config.householdName,
              memberCount:   config.members.length,
            };

            set((s) => ({
              household:       config,
              dayLog,
              dayLogsCache:    { [todayKey()]: dayLog },
              selectedDate:    todayKey(),
              knownHouseholds: [
                entry,
                ...s.knownHouseholds.filter((h) => h.householdId !== householdId),
              ],
              unclaimedHouseholds: s.unclaimedHouseholds.filter((h) => h.id !== householdId),
              sync: { syncing: false, lastSyncedAt: new Date().toISOString(), syncError: null },
            }));

            return { success: true };
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Failed to claim";
            set((s) => ({ sync: { ...s.sync, syncing: false, syncError: msg } }));
            return { success: false, error: msg };
          }
        },

        createAndSwitchHousehold: async (config) => {
          await get().saveHousehold(config);
          // dayLog and household are already set by saveHousehold
          set({ dayLog: emptyDay(), dayLogsCache: {} });
        },

        switchHousehold: async (householdId) => {
          const known = get().knownHouseholds.find((h) => h.householdId === householdId);
          if (!known) return;

          // Re-fetch the config from Supabase for this household
          set((s) => ({ sync: { ...s.sync, syncing: true } }));
          try {
            const { data } = await import("./supabase").then((m) =>
              m.supabase.from("households").select("*").eq("id", householdId).single()
            );
            if (!data) { set((s) => ({ sync: { ...s.sync, syncing: false } })); return; }
            const config  = data.config as HouseholdConfig;
            const meals   = await fetchDayLog(householdId, todayKey());
            const dayLog  = meals
              ? { date: todayKey(), meals: meals as DayLog["meals"] }
              : emptyDay();

            set({
              household:    config,
              dayLog,
              dayLogsCache: { [todayKey()]: dayLog },
              selectedDate: todayKey(),
              foods:        [],
              customFoods:  [],
              sync:         { syncing: false, lastSyncedAt: new Date().toISOString(), syncError: null },
            });
          } catch {
            set((s) => ({ sync: { ...s.sync, syncing: false } }));
          }
        },

        leaveHousehold: (householdId) => {
          set((s) => {
            const remaining = s.knownHouseholds.filter(
              (h) => h.householdId !== householdId
            );
            // If leaving the active household, switch to the next one or reset
            if (s.household.householdId === householdId) {
              const next = remaining[0];
              if (next) {
                // Trigger async switch (fire-and-forget in this sync method)
                setTimeout(() => get().switchHousehold(next.householdId), 0);
              }
              return {
                knownHouseholds: remaining,
                household:       next ? s.household : { ...DEV_HOUSEHOLD },
              };
            }
            return { knownHouseholds: remaining };
          });
        },

        updateMember: async (member) => {
          const updated = {
            ...get().household,
            members: get().household.members.map((m) =>
              m.id === member.id ? member : m
            ),
          };
          set({ household: updated });
          await pushHousehold(updated);
          // Keep knownHouseholds in sync
          set((s) => ({
            knownHouseholds: s.knownHouseholds.map((h) =>
              h.householdId === updated.householdId
                ? { ...h, householdName: updated.householdName, memberCount: updated.members.length }
                : h
            ),
          }));
        },

        // ── Date navigation ────────────────────────────────────────────────

        setSelectedDate: async (date) => {
          const { dayLogsCache } = get();
          const cached = dayLogsCache[date];
          set({ selectedDate: date, dayLog: cached ?? emptyDayForDate(date) });
          if (!cached) await loadDateFromSupabase(date);
        },

        goToPrevDay: async () => {
          const d = new Date(get().selectedDate);
          d.setDate(d.getDate() - 1);
          await get().setSelectedDate(d.toISOString().split("T")[0]);
        },

        goToNextDay: async () => {
          const today = todayKey();
          if (get().selectedDate >= today) return;
          const d = new Date(get().selectedDate);
          d.setDate(d.getDate() + 1);
          await get().setSelectedDate(d.toISOString().split("T")[0]);
        },

        goToToday: async () => get().setSelectedDate(todayKey()),

        // ── Food logging ───────────────────────────────────────────────────

        addFood: (food) => {
          // Deduplicate by id
          const existing = get().dayLog.meals[food.meal].foodsByMember[food.memberId] ?? [];
          if (existing.find((f) => f.id === food.id)) return;

          mutateDayLog((day) => {
            const meal = { ...day.meals[food.meal] };
            const prev = meal.foodsByMember[food.memberId] ?? [];
            meal.foodsByMember = { ...meal.foodsByMember, [food.memberId]: [...prev, food] };
            return { ...day, meals: { ...day.meals, [food.meal]: meal } };
          });

          if (!food.isQuickEntry && food.foodCode) {
            get().trackRecentFood(food.foodCode);
          }
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

        // ── Food catalogue ─────────────────────────────────────────────────

        loadFoods: async () => {
          const { household, customFoods: existing } = get();
          try {
            const foods = await fetchFoods(household.householdId || undefined);
            set({ foods });

            // Also load household food prefs
            if (household.householdId) {
              const prefs = await fetchHouseholdFoodPrefs(household.householdId);
              const prefsMap = Object.fromEntries(prefs.map((p) => [p.food_id, p]));
              set({ householdFoodPrefs: prefsMap });

              // Load legacy custom foods
              const memberId = household.members[0]?.id ?? "";
              const custom = await fetchCustomFoods(household.householdId, memberId);
              set({ customFoods: custom });
            }
          } catch (e) {
            console.error("loadFoods failed:", e);
          }
        },

        addCustomFood: async (food) => {
          const { id, createdAt } = await insertCustomFood(food);
          const full: CustomFoodItem = { ...food, id, createdAt };
          set((s) => ({ customFoods: [...s.customFoods, full] }));
          return full;
        },

        trackRecentFood: (foodCode) => {
          set((s) => ({
            recentFoodCodes: [
              foodCode,
              ...s.recentFoodCodes.filter((c) => c !== foodCode),
            ].slice(0, 20),
          }));
        },

        // ── Derived reads ──────────────────────────────────────────────────

        getMemberFoodsForMeal: (meal, memberId) =>
          get().dayLog.meals[meal].foodsByMember[memberId] ?? [],

        getMealNutrition: (meal, memberId) =>
          sumNutrition(get().getMemberFoodsForMeal(meal, memberId)),

        getMemberNutrition: (memberId) => {
          const { dayLog } = get();
          const allFoods = MEALS.flatMap(
            (m) => dayLog.meals[m].foodsByMember[memberId] ?? []
          );
          return sumNutrition(allFoods);
        },

        // ── Summary ────────────────────────────────────────────────────────

        setShowSummary: (v) => set({ showSummary: v }),

        // ── Sync ───────────────────────────────────────────────────────────

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
            set((s) => ({
              sync: { ...s.sync, syncing: false, lastSyncedAt: new Date().toISOString(), syncError: null },
            }));
          } catch {
            set((s) => ({ sync: { ...s.sync, syncing: false } }));
          }
        },

        resetDay: () => {
          const { selectedDate } = get();
          const day = emptyDayForDate(selectedDate);
          set((s) => ({
            dayLog:       day,
            dayLogsCache: { ...s.dayLogsCache, [selectedDate]: day },
          }));
          pushDayLog(day);
        },

        // ── Auth ───────────────────────────────────────────────────────────

        initAuth: () => {
          // Set up auth state listener and return cleanup function
          const unsubscribe = onAuthStateChange(async (session) => {
            const userId = session?.user?.id ?? null;
            set((s) => ({ currentUserId: userId, authLoading: false, authInitialized: true }));

            if (userId) {
              // User logged in: load their households
              try {
                const households = await fetchUserHouseholds();
                if (households.length > 0) {
                  // Switch to the first household
                  const first = households[0];
                  const config = first.config as HouseholdConfig;
                  const meals = await fetchDayLog(first.id, todayKey());
                  const dayLog = meals
                    ? { date: todayKey(), meals: meals as DayLog["meals"] }
                    : emptyDay();

                  set({
                    household: config,
                    dayLog,
                    dayLogsCache: { [todayKey()]: dayLog },
                    selectedDate: todayKey(),
                    knownHouseholds: households.map((h) => ({
                      householdId: h.id,
                      joinCode: h.joinCode ?? "",
                      householdName: (h.config as HouseholdConfig).householdName,
                      memberCount: (h.config as HouseholdConfig).members.length,
                    })),
                  });
                } else {
                  // User logged in but has no households yet
                  // Check if any unclaimed households exist
                  try {
                    const allHouseholds = await fetchAllHouseholds();
                    const unclaimedHouseholds = allHouseholds.map((h) => ({
                      id: h.id,
                      config: h.config as HouseholdConfig,
                    }));

                    set({
                      household: DEV_HOUSEHOLD,
                      knownHouseholds: [],
                      unclaimedHouseholds,
                    });
                  } catch (e) {
                    console.error("Failed to load unclaimed households:", e);
                    set({
                      household: DEV_HOUSEHOLD,
                      knownHouseholds: [],
                      unclaimedHouseholds: [],
                    });
                  }
                }
              } catch (e) {
                console.error("Failed to load user households:", e);
              }
            } else {
              // User logged out: reset to default state
              set({
                currentUserId: null,
                household: DEV_HOUSEHOLD,
                knownHouseholds: [],
                unclaimedHouseholds: [],
                dayLog: emptyDay(),
                dayLogsCache: {},
                selectedDate: todayKey(),
                foods: [],
                householdFoodPrefs: {},
                customFoods: [],
              });
            }
          });

          return unsubscribe;
        },

        setAuthLoading: (loading) => {
          set({ authLoading: loading });
        },

        logout: async () => {
          await authLogout();
          // onAuthStateChange will fire and reset state via initAuth
        },
      };
    },
    {
      name: "homeplate-store-v5",
      partialize: (s) => ({
        // Do NOT persist currentUserId - it changes with auth state
        household:         s.household,
        knownHouseholds:   s.knownHouseholds,
        selectedDate:      s.selectedDate,
        dayLog:            s.dayLog,
        dayLogsCache:      s.dayLogsCache,
        customFoods:       s.customFoods,
        recentFoodCodes:   s.recentFoodCodes,
      }),
    }
  )
);

export { MEALS };
export { generateJoinCode };
