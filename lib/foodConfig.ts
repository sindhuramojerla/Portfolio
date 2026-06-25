/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  HomePlate — Food Configuration File                                    ║
 * ║                                                                         ║
 * ║  This is the single file to edit when you want to:                      ║
 * ║    • Add a new food                                                     ║
 * ║    • Change calorie / nutrition values                                  ║
 * ║    • Edit allowed serving units                                         ║
 * ║    • Change portion presets                                             ║
 * ║    • Add preparation options                                            ║
 * ║    • Add optional additions                                             ║
 * ║    • Mark a food inactive                                               ║
 * ║                                                                         ║
 * ║  After editing, run the seed script to push changes to Supabase:       ║
 * ║    npx ts-node lib/foodSeed.ts                                          ║
 * ║                                                                         ║
 * ║  Data sources:                                                          ║
 * ║    USDA    = USDA FoodData Central (fdc.nal.usda.gov)                  ║
 * ║    NIN     = National Institute of Nutrition India                      ║
 * ║    APPROX  = Standard Indian recipe approximation                      ║
 * ║    DRAFT   = Unverified — update before trusting                       ║
 * ║    RECIPE  = Household-specific recipe — edit custom_calories in prefs ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

export interface FoodConfig {
  food_code: string;             // Stable slug — never change after first publish
  name: string;
  aliases?: string[];
  category: "Homemade" | "Basic Foods" | "Packaged Foods" | "Protein" | "Drinks" | "Fruits" | "Additions";
  food_type?: "global" | "household" | "personal" | "packaged";
  is_active?: boolean;           // Set false to hide without deleting

  // Serving definition (nutrition values are PER 1 × default_serving_unit)
  default_serving_qty: number;
  default_serving_unit: string;
  allowed_units: string[];
  grams_per_default_unit?: number | null;

  // Nutrition per 1 × default_serving_qty × default_serving_unit
  calories: number;
  protein: number;
  carbs: number;
  fibre: number;
  fat: number;

  // Presets shown in the UI picker
  portion_presets: Array<{ qty: number; label: string }>;

  // Dynamic preparation options
  preparation_options?: Array<{
    key: string;
    label: string;
    type: "single" | "toggle";
    options: Array<{
      value: string;
      label: string;
      cal_multiplier?: number;
      extra_cal?: number;
    }>;
  }>;

  // Names of additions that can be added to this food
  allowed_additions?: string[];

  // Data provenance
  confidence: "validated" | "approximate" | "draft";
  source_notes?: string;
}

// ─── Shared presets (import & reuse) ─────────────────────────────────────────

export const KATORI_PRESETS = [
  { qty: 0.5, label: "½ katori" },
  { qty: 1,   label: "1 katori" },
  { qty: 1.5, label: "1½ katoris" },
  { qty: 2,   label: "2 katoris" },
];

export const OIL_OPTION = {
  key: "oil_level",
  label: "Oil level",
  type: "single" as const,
  options: [
    { value: "less",   label: "Less oily",  cal_multiplier: 0.85 },
    { value: "normal", label: "Normal",     cal_multiplier: 1.0  },
    { value: "more",   label: "More oily",  cal_multiplier: 1.18 },
  ],
};

export const CURRY_ADDITIONS = ["Potato", "Coconut", "Peanuts", "Chana dal"];

// ─── Food catalogue ───────────────────────────────────────────────────────────
// Edit this array to manage the global food list.
// Run `npx ts-node lib/foodSeed.ts` to push changes to Supabase.

export const FOOD_CATALOGUE: FoodConfig[] = [

  // ── CURRIES & VEGETABLES ────────────────────────────────────────────────
  {
    food_code: "sorakaya-tomato-curry",
    name: "Sorakaya Tomato Curry",
    aliases: ["Bottle gourd curry", "Lauki curry", "Ghiya curry"],
    category: "Homemade",
    default_serving_qty: 1, default_serving_unit: "katori",
    allowed_units: ["katori", "cup", "gram"],
    grams_per_default_unit: 150,
    calories: 95, protein: 2, carbs: 10, fibre: 2.5, fat: 5,
    portion_presets: KATORI_PRESETS,
    preparation_options: [OIL_OPTION],
    allowed_additions: ["Potato", "Coconut", "Chana dal"],
    confidence: "approximate", source_notes: "Standard Indian recipe; NIN India reference",
  },
  {
    food_code: "sorakaya-pappu",
    name: "Sorakaya Pappu",
    aliases: ["Bottle gourd dal", "Lauki dal"],
    category: "Homemade",
    default_serving_qty: 1, default_serving_unit: "katori",
    allowed_units: ["katori", "cup", "gram"],
    grams_per_default_unit: 150,
    calories: 140, protein: 8, carbs: 16, fibre: 3.5, fat: 4,
    portion_presets: KATORI_PRESETS,
    preparation_options: [OIL_OPTION],
    allowed_additions: ["Coconut"],
    confidence: "approximate", source_notes: "Standard dal recipe; NIN India reference",
  },
  {
    food_code: "bendakaya-fry",
    name: "Bendakaya Fry",
    aliases: ["Okra fry", "Lady finger fry", "Bhindi fry"],
    category: "Homemade",
    default_serving_qty: 1, default_serving_unit: "katori",
    allowed_units: ["katori", "cup", "gram"],
    grams_per_default_unit: 120,
    calories: 105, protein: 2.5, carbs: 9, fibre: 3, fat: 6.5,
    portion_presets: KATORI_PRESETS,
    preparation_options: [OIL_OPTION],
    allowed_additions: ["Peanuts", "Coconut"],
    confidence: "approximate", source_notes: "Standard recipe; NIN India reference",
  },
  {
    food_code: "tomato-pappu",
    name: "Tomato Pappu",
    aliases: ["Tomato dal", "Tamatar dal"],
    category: "Homemade",
    default_serving_qty: 1, default_serving_unit: "katori",
    allowed_units: ["katori", "cup", "gram"],
    grams_per_default_unit: 150,
    calories: 140, protein: 8, carbs: 18, fibre: 4, fat: 4,
    portion_presets: KATORI_PRESETS,
    preparation_options: [OIL_OPTION],
    allowed_additions: ["Coconut"],
    confidence: "approximate", source_notes: "Standard recipe; existing app data",
  },
  {
    food_code: "beans-tomato-curry",
    name: "Beans Tomato Curry",
    aliases: ["Green beans tomato curry"],
    category: "Homemade",
    default_serving_qty: 1, default_serving_unit: "katori",
    allowed_units: ["katori", "cup", "gram"],
    grams_per_default_unit: 150,
    calories: 120, protein: 4.5, carbs: 14, fibre: 4, fat: 5,
    portion_presets: KATORI_PRESETS,
    preparation_options: [OIL_OPTION],
    allowed_additions: [...CURRY_ADDITIONS],
    confidence: "approximate", source_notes: "Standard recipe; existing app data",
  },
  // … add more here following the same pattern …

  // ── EGGS ────────────────────────────────────────────────────────────────
  {
    food_code: "egg-whole",
    name: "Egg",
    aliases: ["Anda", "Hen egg", "Whole egg"],
    category: "Basic Foods",
    default_serving_qty: 1, default_serving_unit: "piece",
    allowed_units: ["piece"],
    grams_per_default_unit: 55,
    calories: 78, protein: 6, carbs: 0.6, fibre: 0, fat: 5,
    portion_presets: [
      { qty: 1, label: "1 egg" },
      { qty: 2, label: "2 eggs" },
      { qty: 3, label: "3 eggs" },
    ],
    preparation_options: [
      {
        key: "size", label: "Size", type: "single",
        options: [
          { value: "medium", label: "Medium (~55g)",  cal_multiplier: 1.0  },
          { value: "large",  label: "Large (~65g)",   cal_multiplier: 1.18 },
        ],
      },
      {
        key: "style", label: "Preparation", type: "single",
        options: [
          { value: "boiled",    label: "Boiled",    cal_multiplier: 1.0  },
          { value: "poached",   label: "Poached",   cal_multiplier: 1.0  },
          { value: "omelette",  label: "Omelette",  cal_multiplier: 1.15 },
          { value: "scrambled", label: "Scrambled", cal_multiplier: 1.15 },
        ],
      },
    ],
    allowed_additions: [],
    confidence: "validated", source_notes: "USDA FoodData Central #173424; medium whole egg ~55g",
  },

  // ── CHICKEN BREAST (standalone, not curry) ───────────────────────────────
  {
    food_code: "chicken-breast-cooked",
    name: "Chicken Breast",
    aliases: ["Boneless chicken", "Grilled chicken", "White meat"],
    category: "Protein",
    default_serving_qty: 100, default_serving_unit: "gram",
    allowed_units: ["gram", "piece"],
    grams_per_default_unit: 100,
    calories: 165, protein: 31, carbs: 0, fibre: 0, fat: 3.6,
    portion_presets: [
      { qty: 100, label: "100g" },
      { qty: 150, label: "150g" },
      { qty: 200, label: "200g" },
      { qty: 250, label: "250g" },
    ],
    preparation_options: [
      {
        key: "style", label: "Cooking style", type: "single",
        options: [
          { value: "grilled",  label: "Grilled / baked", cal_multiplier: 1.0  },
          { value: "pan_fried",label: "Pan fried",        cal_multiplier: 1.12 },
          { value: "boiled",   label: "Boiled / steamed", cal_multiplier: 0.95 },
        ],
      },
    ],
    allowed_additions: [],
    confidence: "validated", source_notes: "USDA FoodData Central #331960; per 100g cooked boneless",
  },

  // ── PROTEIN POWDERS ──────────────────────────────────────────────────────
  {
    food_code: "whey-isolate",
    name: "Whey Isolate Protein Powder",
    aliases: ["Whey protein", "WPI"],
    category: "Protein",
    default_serving_qty: 1, default_serving_unit: "scoop",
    allowed_units: ["scoop", "gram"],
    grams_per_default_unit: 30,
    // ⚠️  DRAFT: values vary by brand — check product label before trusting
    calories: 110, protein: 25, carbs: 2, fibre: 0, fat: 0.5,
    portion_presets: [
      { qty: 1,   label: "1 scoop (~30g)" },
      { qty: 1.5, label: "1½ scoops"      },
      { qty: 2,   label: "2 scoops"        },
    ],
    preparation_options: [],
    allowed_additions: [],
    confidence: "draft", source_notes: "Approximate; values vary by brand — check product label",
  },
  {
    food_code: "cosmix-plant-protein",
    name: "Cosmix Unflavoured Plant Protein",
    aliases: ["Cosmix protein", "Plant protein powder"],
    category: "Protein",
    food_type: "packaged",
    default_serving_qty: 1, default_serving_unit: "scoop",
    allowed_units: ["scoop", "gram"],
    grams_per_default_unit: 25,
    // ⚠️  DRAFT: check current Cosmix product label
    calories: 90, protein: 15, carbs: 7, fibre: 2, fat: 1.5,
    portion_presets: [
      { qty: 1, label: "1 scoop (~25g)" },
      { qty: 2, label: "2 scoops"        },
    ],
    preparation_options: [],
    allowed_additions: [],
    confidence: "draft", source_notes: "Check current Cosmix product label — values may change",
  },

  // ── ADD NEW FOODS BELOW THIS LINE ────────────────────────────────────────
  // Copy an existing entry and change:
  //   1. food_code   (unique slug, never reuse)
  //   2. name
  //   3. calories / protein / carbs / fibre / fat
  //   4. serving unit, grams_per_default_unit
  //   5. portion_presets
  //   6. confidence + source_notes
  // Then run: npx ts-node lib/foodSeed.ts
];
