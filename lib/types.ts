// ─── Members ─────────────────────────────────────────────────────────────────

export interface NutritionGoals {
  calories: number;
  protein: number;
  carbs: number;
  fibre: number;
  fat: number;
}

export interface Member {
  id: string;
  name: string;
  initials: string;
  avatarColor: string; // e.g. "bg-orange-400"
  goals: NutritionGoals;
}

export interface HouseholdConfig {
  householdName: string;
  members: Member[];
  onboardingComplete: boolean;
  householdId: string;
  joinCode: string;
}

/** Lightweight record stored in knownHouseholds array */
export interface KnownHousehold {
  householdId: string;
  joinCode: string;
  householdName: string;
  memberCount: number;
}

// ─── Serving / units ─────────────────────────────────────────────────────────

export type ServingUnit =
  | "katori" | "cup" | "ml" | "gram" | "piece"
  | "slice" | "scoop" | "tablespoon" | "teaspoon" | "serving";

export interface PortionPreset {
  qty: number;
  label: string;
}

export interface PrepOption {
  value: string;
  label: string;
  cal_multiplier?: number; // multiply base calories
  extra_cal?: number;      // add flat calories
  note?: string;
}

export interface PrepOptionGroup {
  key: string;
  label: string;
  type: "single" | "toggle";
  options: PrepOption[];
}

// ─── Food (Supabase-backed) ───────────────────────────────────────────────────

export type FoodCategory =
  | "Homemade" | "Basic Foods" | "Packaged Foods"
  | "Protein" | "Drinks" | "Fruits" | "Additions";

export type FoodType = "global" | "household" | "personal" | "packaged";
export type Confidence = "validated" | "approximate" | "draft";

/** A food row from the `foods` Supabase table */
export interface SupabaseFood {
  id: string;
  food_code: string;
  name: string;
  aliases: string[];
  category: FoodCategory;
  food_type: FoodType;
  default_serving_qty: number;
  default_serving_unit: ServingUnit;
  allowed_units: ServingUnit[];
  grams_per_default_unit: number | null;
  calories: number;
  protein: number;
  carbs: number;
  fibre: number;
  fat: number;
  portion_presets: PortionPreset[];
  preparation_options: PrepOptionGroup[];
  allowed_additions: string[];
  confidence: Confidence;
  source_notes: string | null;
  is_active: boolean;
  household_id: string | null;
  created_by_member_id: string | null;
}

/** Household-level recipe preferences for a specific food */
export interface HouseholdFoodPref {
  id: string;
  household_id: string;
  food_id: string;
  no_onion: boolean;
  no_garlic: boolean;
  default_oil_level: string | null;
  default_additions: string[];
  default_serving_unit: string | null;
  default_serving_qty: number | null;
  custom_calories: number | null;
  custom_protein: number | null;
  custom_carbs: number | null;
  custom_fibre: number | null;
  custom_fat: number | null;
  notes: string | null;
}

// ─── Legacy FoodItem (kept for backward-compat in LoggedFood snapshots) ───────

export type OilLevel = "Less oily" | "Normal" | "More oily";
export type PortionSize = "½ katori" | "1 katori" | "1½ katoris" | "2 katoris" | "Custom";
export type FoodSource = "builtin" | "custom" | "quick" | "supabase";

/** Lightweight food descriptor embedded in diary entries.
 *  Once saved, these are immutable — editing the source food
 *  never changes historical entries. */
export interface FoodItem {
  id: string;       // food_code or uuid
  name: string;
  category: FoodCategory;
  baseNutrition: Nutrition; // per 1 × default serving
  unit: string;
  source?: FoodSource;
}

// ─── Nutrition ───────────────────────────────────────────────────────────────

export interface Nutrition {
  calories: number;
  protein: number;
  carbs: number;
  fibre: number;
  fat: number;
}

// ─── Diary logging ───────────────────────────────────────────────────────────

export type MealType = "Breakfast" | "Lunch" | "Dinner" | "Snacks";
export type EntryType = "search" | "quick";

/** A complete nutrition snapshot stored in day_logs.
 *  All fields needed for display are stored here — no live lookup. */
export interface LoggedFood {
  id: string;
  foodItem: FoodItem;        // snapshot at logging time
  foodCode?: string;         // stable reference (won't break if food changes)
  memberId: string;
  meal: MealType;

  // Serving at time of logging
  servingQty: number;
  servingUnit: string;

  // Kept for backward-compat with older diary entries
  portion?: PortionSize | string;
  customPortionMultiplier?: number;

  // Preparation choices (key → value)
  prepChoices?: Record<string, string>;

  // Legacy oil level
  oilLevel?: OilLevel;
  addedIngredients?: string[];

  // Calculated nutrition snapshot
  nutrition: Nutrition;

  timestamp: string;
  entryType: EntryType;
  isQuickEntry?: boolean;
  quickDescription?: string;
}

export interface MealLog {
  meal: MealType;
  foodsByMember: Record<string, LoggedFood[]>;
  doneByMember:  Record<string, boolean>;
}

export interface DayLog {
  date: string;
  meals: Record<MealType, MealLog>;
}

// ─── Custom foods (existing table) ───────────────────────────────────────────

export interface CustomFoodItem {
  id: string;
  householdId: string;
  createdByMemberId: string;
  name: string;
  category: FoodCategory;
  servingName: string;
  nutrition: Nutrition;
  scope: "household" | "personal";
  createdAt: string;
}

// ─── Additions ───────────────────────────────────────────────────────────────

export interface AddedIngredient {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fibre: number;
  fat: number;
}
