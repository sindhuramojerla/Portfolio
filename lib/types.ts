// ---------- Members ----------

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

// ---------- Food ----------

export type MealType = "Breakfast" | "Lunch" | "Dinner" | "Snacks";
export type FoodCategory = "Homemade" | "Basic Foods" | "Packaged Foods";
export type OilLevel = "Less oily" | "Normal" | "More oily";
export type PortionSize = "½ katori" | "1 katori" | "1½ katoris" | "2 katoris" | "Custom";
export type FoodSource = "builtin" | "custom" | "quick";

export interface AddedIngredient {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fibre: number;
  fat: number;
}

export interface Nutrition {
  calories: number;
  protein: number;
  carbs: number;
  fibre: number;
  fat: number;
}

export interface FoodItem {
  id: string;
  name: string;
  category: FoodCategory;
  baseNutrition: Nutrition; // per 1 unit/katori
  unit: string;
  source?: FoodSource;      // undefined = builtin
}

/** A food saved/created by a household member */
export interface CustomFoodItem {
  id: string;
  householdId: string;
  createdByMemberId: string;
  name: string;
  category: FoodCategory;
  servingName: string;   // e.g. "1 katori", "1 slice"
  nutrition: Nutrition;  // per one serving
  scope: "household" | "personal";
  createdAt: string;
}

// ---------- Logging ----------

export type EntryType = "search" | "quick";

export interface LoggedFood {
  id: string;
  foodItem: FoodItem;        // For quick entries we synthesise a FoodItem
  memberId: string;
  meal: MealType;
  portion: PortionSize | string;
  customPortionMultiplier?: number;
  oilLevel?: OilLevel;
  addedIngredients?: string[];
  nutrition: Nutrition;
  timestamp: string;
  entryType: EntryType;
  isQuickEntry?: boolean;    // true for quick calorie entries
  quickDescription?: string; // shown in lists for quick entries
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
