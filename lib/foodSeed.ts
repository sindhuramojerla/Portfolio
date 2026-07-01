import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";

// Load .env.local
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const [key, value] = trimmed.split("=");
    if (key && value && !process.env[key]) {
      process.env[key] = value.trim();
    }
  });
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment");
  console.error("   Set them in .env.local or export them before running this script");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function seedFoods() {
  // Load foods directly from JSON file
  const foodsData = JSON.parse(fs.readFileSync(path.join(process.cwd(), "foods_clean.json"), "utf-8"));

  console.log("🌱 Seeding food catalogue...\n");

  let successCount = 0;
  let errorCount = 0;

  for (const food of foodsData) {
    try {
      const { error } = await supabase.from("foods").upsert(
        {
          food_code: food.food_code,
          name: food.name,
          aliases: food.aliases || [],
          category: food.category,
          food_type: food.food_type || "global",
          is_active: food.is_active !== false,
          default_serving_qty: food.default_serving_qty,
          default_serving_unit: food.default_serving_unit,
          allowed_units: food.allowed_units,
          grams_per_default_unit: food.grams_per_default_unit || null,
          calories: food.calories,
          protein: food.protein,
          carbs: food.carbs,
          fibre: food.fibre,
          fat: food.fat,
          portion_presets: food.portion_presets,
          preparation_options: food.preparation_options || [],
          allowed_additions: food.allowed_additions || [],
          confidence: food.confidence,
          source_notes: food.source_notes || null,
          household_id: null,
          created_by_member_id: null,
        },
        { onConflict: "food_code" }
      );

      if (error) {
        console.error(`❌ ${food.name}: ${error.message}`);
        errorCount++;
      } else {
        console.log(`✓ ${food.name}`);
        successCount++;
      }
    } catch (e) {
      console.error(`❌ ${food.name}: ${e instanceof Error ? e.message : String(e)}`);
      errorCount++;
    }
  }

  console.log(`\n════════════════════════════════════════════════════════════════`);
  console.log(`✅ Seeding complete`);
  console.log(`   Successful: ${successCount}`);
  console.log(`   Errors: ${errorCount}`);
  console.log(`════════════════════════════════════════════════════════════════`);

  if (errorCount > 0) {
    process.exit(1);
  }
}

seedFoods().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
