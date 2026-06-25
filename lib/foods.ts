import { FoodItem, OilLevel, Nutrition, PortionSize, AddedIngredient, NutritionGoals } from "./types";

export const MEALS = ["Breakfast", "Lunch", "Dinner", "Snacks"] as const;

export const PORTIONS: Record<PortionSize, number> = {
  "½ katori": 0.5,
  "1 katori": 1,
  "1½ katoris": 1.5,
  "2 katoris": 2,
  Custom: 1,
};

export const OIL_MULTIPLIERS: Record<OilLevel, number> = {
  "Less oily": 0.85,
  Normal: 1,
  "More oily": 1.18,
};

export const ADDED_INGREDIENTS: AddedIngredient[] = [
  { name: "Potato",    calories: 35, protein: 0.8, carbs: 8,   fibre: 0.7, fat: 0   },
  { name: "Coconut",   calories: 45, protein: 0.5, carbs: 2,   fibre: 1.5, fat: 4   },
  { name: "Peanuts",   calories: 55, protein: 2.5, carbs: 2,   fibre: 0.8, fat: 4.5 },
  { name: "Chana dal", calories: 40, protein: 2.8, carbs: 6.5, fibre: 1.2, fat: 0.5 },
  { name: "Other",     calories: 20, protein: 0.5, carbs: 3,   fibre: 0.5, fat: 0.5 },
];

export const FOODS: FoodItem[] = [
  {
    id: "beans-tomato-curry",
    name: "Beans Tomato Curry",
    category: "Homemade",
    baseNutrition: { calories: 120, protein: 4.5, carbs: 14, fibre: 4,   fat: 5   },
    unit: "katori",
  },
  {
    id: "sorakaya-tomato-curry",
    name: "Sorakaya Tomato Curry",
    category: "Homemade",
    baseNutrition: { calories: 95,  protein: 2,   carbs: 10, fibre: 2.5, fat: 5   },
    unit: "katori",
  },
  {
    id: "tomato-pappu",
    name: "Tomato Pappu",
    category: "Homemade",
    baseNutrition: { calories: 140, protein: 8,   carbs: 18, fibre: 4,   fat: 4   },
    unit: "katori",
  },
  {
    id: "bendakaya-fry",
    name: "Bendakaya Fry",
    category: "Homemade",
    baseNutrition: { calories: 105, protein: 2.5, carbs: 9,  fibre: 3,   fat: 6.5 },
    unit: "katori",
  },
  {
    id: "rice",
    name: "Rice",
    category: "Basic Foods",
    baseNutrition: { calories: 130, protein: 2.5, carbs: 28, fibre: 0.4, fat: 0.3 },
    unit: "katori",
  },
  {
    id: "roti",
    name: "Roti",
    category: "Basic Foods",
    baseNutrition: { calories: 80,  protein: 2.5, carbs: 15, fibre: 1.5, fat: 1.5 },
    unit: "piece",
  },
  {
    id: "egg",
    name: "Egg",
    category: "Basic Foods",
    baseNutrition: { calories: 78,  protein: 6,   carbs: 0.6,fibre: 0,   fat: 5   },
    unit: "piece",
  },
  {
    id: "milk",
    name: "Milk",
    category: "Basic Foods",
    baseNutrition: { calories: 60,  protein: 3.2, carbs: 4.8,fibre: 0,   fat: 3.2 },
    unit: "glass (200ml)",
  },
  {
    id: "banana",
    name: "Banana",
    category: "Basic Foods",
    baseNutrition: { calories: 90,  protein: 1.1, carbs: 23, fibre: 2.6, fat: 0.3 },
    unit: "piece",
  },
  {
    id: "packaged-bread",
    name: "Packaged Bread",
    category: "Packaged Foods",
    baseNutrition: { calories: 75,  protein: 2.5, carbs: 14, fibre: 0.8, fat: 1   },
    unit: "slice",
  },
  {
    id: "packaged-curd",
    name: "Packaged Curd",
    category: "Packaged Foods",
    baseNutrition: { calories: 60,  protein: 3.5, carbs: 4.5,fibre: 0,   fat: 3   },
    unit: "katori (100g)",
  },
];

export function calculateNutrition(
  food: FoodItem,
  portionMultiplier: number,
  oilLevel?: OilLevel,
  addedIngredientNames?: string[]
): Nutrition {
  const oil = oilLevel ? OIL_MULTIPLIERS[oilLevel] : 1;
  const applyOil = food.category === "Homemade";
  const scale = portionMultiplier * (applyOil ? oil : 1);
  const b = food.baseNutrition;

  const r = (v: number) => Math.round(v * 10) / 10;

  let nutrition: Nutrition = {
    calories: Math.round(b.calories * scale),
    protein: r(b.protein * scale),
    carbs:   r(b.carbs   * scale),
    fibre:   r(b.fibre   * scale),
    fat:     r(b.fat     * scale),
  };

  if (addedIngredientNames?.length) {
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
  }

  return nutrition;
}

/** Default goals used in the onboarding form as placeholder values */
export const DEFAULT_GOALS: NutritionGoals = {
  calories: 2000,
  protein: 100,
  carbs: 200,
  fibre: 25,
  fat: 60,
};

/** Member avatar palette — assigned in order during onboarding */
export const AVATAR_COLORS = [
  "bg-orange-400",
  "bg-rose-400",
  "bg-violet-400",
  "bg-teal-400",
];

/** Derive initials from a name (first + last initial, or first two chars) */
export function deriveInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}
