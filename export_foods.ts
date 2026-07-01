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

async function exportFoods() {
  const { data, error } = await supabase
    .from("foods")
    .select("*")
    .order("category");
  
  if (error) {
    console.error("Error:", error);
    process.exit(1);
  }

  console.log(JSON.stringify(data, null, 2));
}

exportFoods();
