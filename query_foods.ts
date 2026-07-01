import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Load .env.local
const envPath = path.join(process.cwd(), ".env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
envContent.split("\n").forEach((line) => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return;
  const [key, value] = trimmed.split("=");
  if (key && value && !process.env[key]) {
    process.env[key] = value.trim();
  }
});

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getFoods() {
  const { data, error } = await supabase
    .from("foods")
    .select("food_code, name, category");
  
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Foods in Supabase:");
    const categories: Record<string, any[]> = {};
    data?.forEach((food: any) => {
      if (!categories[food.category]) categories[food.category] = [];
      categories[food.category].push(food);
    });
    
    for (const [cat, foods] of Object.entries(categories)) {
      console.log(`\n${cat}:`);
      (foods as any[]).forEach((f) => console.log(`  • ${f.name} (${f.food_code})`));
    }
    console.log(`\nTotal: ${data?.length || 0} foods`);
  }
}

getFoods();
