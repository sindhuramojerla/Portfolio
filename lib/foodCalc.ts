/**
 * Nutrition calculation engine.
 *
 * Supports the new SupabaseFood structure with:
 * - Multiple serving units per food
 * - Gram-based cross-unit scaling
 * - Preparation options (multipliers + flat additions)
 * - Optional additions (from ADDED_INGREDIENTS or custom)
 */

import { Nutrition, SupabaseFood, PrepOptionGroup } from "./types";
import { ADDED_INGREDIENTS } from "./foods";

// ─── Unit conversions (built-in approximations) ───────────────────────────────
// These are used when grams_per_default_unit is available.
// Maps unit → grams for common units.
const UNIT_GRAM_DEFAULTS: Partial<Record<string, number>> = {
  gram:        1,
  ml:          1,      // water-density approximation
  katori:      150,    // 1 standard katori ~150g
  cup:         240,    // 1 US cup ~240ml/g
  tablespoon:  15,
  teaspoon:    5,
  slice:       30,     // generic slice ~30g
  scoop:       30,     // generic scoop ~30g
  piece:       null!,  // varies per food — must use food-specific value
  serving:     null!,  // defined per food
};

/**
 * Calculate nutrition for a food given quantity, unit, and preparation choices.
 *
 * Algorithm:
 * 1. Determine scale factor relative to the food's default serving
 * 2. Apply preparation multipliers (cumulative product)
 * 3. Add flat extra calories from preparation options
 * 4. Add additions
 */
export function calculateNutritionV2(
  food: SupabaseFood,
  quantity: number,
  unit: string,
  prepChoices: Record<string, string> = {},
  addedIngredientNames: string[] = []
): Nutrition {
  // ── Step 1: scale by quantity and unit ──────────────────────────────────
  let scale = quantity / food.default_serving_qty;

  const isSameUnit = unit === food.default_serving_unit;

  if (!isSameUnit) {
    // Try gram-based cross-unit scaling
    const baseGrams = food.grams_per_default_unit ??
      UNIT_GRAM_DEFAULTS[food.default_serving_unit] ?? null;
    const reqGrams  = UNIT_GRAM_DEFAULTS[unit] ?? null;

    if (baseGrams && reqGrams) {
      // scale = (quantity × grams_per_requested_unit) / (default_qty × grams_per_default_unit)
      scale = (quantity * reqGrams) / (food.default_serving_qty * baseGrams);
    }
    // else: fall back to multiplier-only scaling (already set above)
  }

  // ── Step 2: apply preparation multipliers ───────────────────────────────
  let calMultiplier = 1;
  let extraCal      = 0;

  for (const group of food.preparation_options) {
    const chosenValue = prepChoices[group.key];
    if (!chosenValue) continue;
    const option = group.options.find((o) => o.value === chosenValue);
    if (!option) continue;
    if (option.cal_multiplier != null) calMultiplier *= option.cal_multiplier;
    if (option.extra_cal      != null) extraCal      += option.extra_cal;
  }

  // ── Step 3: base nutrition ──────────────────────────────────────────────
  const r = (v: number) => Math.round(v * 10) / 10;
  const sc = scale * calMultiplier;

  const nutrition: Nutrition = {
    calories: Math.round(food.calories * sc) + extraCal,
    protein:  r(food.protein * sc),
    carbs:    r(food.carbs   * sc),
    fibre:    r(food.fibre   * sc),
    fat:      r(food.fat     * sc),
  };

  // ── Step 4: additions ───────────────────────────────────────────────────
  for (const name of addedIngredientNames) {
    const ing = ADDED_INGREDIENTS.find((i) => i.name === name);
    if (ing) {
      nutrition.calories += ing.calories;
      nutrition.protein  += ing.protein;
      nutrition.carbs    += ing.carbs;
      nutrition.fibre    += ing.fibre;
      nutrition.fat      += ing.fat;
    }
  }

  return nutrition;
}

/** Human-readable label for a quantity + unit combination */
export function servingLabel(qty: number, unit: string): string {
  const qtyStr = qty === Math.floor(qty) ? String(qty) : qty.toFixed(1);
  const plural  = qty !== 1 && !["gram", "ml"].includes(unit);
  const unitLbl = plural ? pluralUnit(unit) : unit;
  return `${qtyStr} ${unitLbl}`;
}

function pluralUnit(unit: string): string {
  const map: Record<string, string> = {
    katori:     "katoris",
    cup:        "cups",
    piece:      "pieces",
    slice:      "slices",
    scoop:      "scoops",
    tablespoon: "tablespoons",
    teaspoon:   "teaspoons",
    serving:    "servings",
  };
  return map[unit] ?? unit;
}

/** Convert a SupabaseFood into the legacy FoodItem shape (for LoggedFood snapshots) */
export function supabaseFoodToFoodItem(food: SupabaseFood) {
  return {
    id:   food.food_code,
    name: food.name,
    category: food.category,
    baseNutrition: {
      calories: food.calories,
      protein:  food.protein,
      carbs:    food.carbs,
      fibre:    food.fibre,
      fat:      food.fat,
    },
    unit:   food.default_serving_unit,
    source: "supabase" as const,
  };
}
