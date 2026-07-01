import * as fs from 'fs';
import * as path from 'path';

// Read the raw file
const rawContent = fs.readFileSync('all_foods.json', 'utf-8');

// Find where JSON starts (first '[')
const jsonStart = rawContent.indexOf('[');
const jsonContent = rawContent.substring(jsonStart);

// Parse JSON
const foods = JSON.parse(jsonContent);

let output = `/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  HomePlate — Food Configuration File (AUTO-GENERATED)                   ║
 * ║                                                                         ║
 * ║  ALL 53 FOODS RESTORED FROM SUPABASE DATABASE                          ║
 * ║  Generated: ${new Date().toISOString()}                          ║
 * ║                                                                         ║
 * ║  To edit: modify values and run: npm run seed                          ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

export interface FoodConfig {
  food_code: string;
  name: string;
  aliases?: string[];
  category: "Homemade" | "Basic Foods" | "Packaged Foods" | "Protein" | "Drinks" | "Fruits" | "Additions";
  food_type?: "global" | "household" | "personal" | "packaged";
  is_active?: boolean;
  default_serving_qty: number;
  default_serving_unit: string;
  allowed_units: string[];
  grams_per_default_unit?: number | null;
  calories: number;
  protein: number;
  carbs: number;
  fibre: number;
  fat: number;
  portion_presets: Array<{ qty: number; label: string }>;
  preparation_options?: Array<any>;
  allowed_additions?: string[];
  confidence: "validated" | "approximate" | "draft";
  source_notes?: string;
}

export const FOOD_CATALOGUE: FoodConfig[] = [
`;

foods.forEach((food, idx) => {
  const aliases = food.aliases && food.aliases.length > 0 ? `aliases: ${JSON.stringify(food.aliases)},\n    ` : '';
  const foodType = food.food_type ? `food_type: "${food.food_type}",\n    ` : '';
  const gramsDefault = food.grams_per_default_unit !== null ? `grams_per_default_unit: ${food.grams_per_default_unit},\n    ` : `grams_per_default_unit: null,\n    `;
  const sourceNotes = food.source_notes ? `source_notes: "${food.source_notes.replace(/"/g, '\\"')}",\n    ` : '';
  const allowedAdditions = food.allowed_additions && food.allowed_additions.length > 0 ? `allowed_additions: ${JSON.stringify(food.allowed_additions)},\n    ` : `allowed_additions: [],\n    `;
  
  const prepJson = JSON.stringify(food.preparation_options || []);
  const prep = prepJson !== '[]' ? `preparation_options: ${prepJson},\n    ` : `preparation_options: [],\n    `;

  output += `  {
    food_code: "${food.food_code}",
    name: "${food.name}",
    ${aliases}${foodType}default_serving_qty: ${food.default_serving_qty},
    default_serving_unit: "${food.default_serving_unit}",
    allowed_units: ${JSON.stringify(food.allowed_units)},
    ${gramsDefault}calories: ${food.calories},
    protein: ${food.protein},
    carbs: ${food.carbs},
    fibre: ${food.fibre},
    fat: ${food.fat},
    portion_presets: ${JSON.stringify(food.portion_presets)},
    ${prep}${allowedAdditions}confidence: "${food.confidence}",
    ${sourceNotes}is_active: ${food.is_active !== false},
  },
`;
});

output += `
];
`;

fs.writeFileSync('lib/foodConfig.ts', output);
console.log('✅ foodConfig.ts generated with all ' + foods.length + ' foods');
