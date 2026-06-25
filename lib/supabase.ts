import { createClient } from "@supabase/supabase-js";
import { CustomFoodItem } from "./types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, key);

// ─── join codes ──────────────────────────────────────────────────────────────

export function generateJoinCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "HP";
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// ─── households ──────────────────────────────────────────────────────────────

export async function fetchHouseholdByCode(joinCode: string) {
  const { data, error } = await supabase
    .from("households")
    .select("*")
    .eq("join_code", joinCode.toUpperCase().trim())
    .single();
  if (error) return null;
  return data as { id: string; join_code: string; config: object };
}

export async function upsertHousehold(id: string, joinCode: string, config: object) {
  const { error } = await supabase
    .from("households")
    .upsert({ id, join_code: joinCode, config }, { onConflict: "id" });
  if (error) throw error;
}

// ─── day logs ────────────────────────────────────────────────────────────────

export async function fetchDayLog(householdId: string, date: string) {
  const { data, error } = await supabase
    .from("day_logs")
    .select("meals")
    .eq("household_id", householdId)
    .eq("date", date)
    .single();
  if (error) return null;
  return data.meals;
}

export async function upsertDayLog(householdId: string, date: string, meals: object) {
  const { error } = await supabase
    .from("day_logs")
    .upsert({ household_id: householdId, date, meals }, { onConflict: "household_id,date" });
  if (error) throw error;
}

// ─── custom foods ────────────────────────────────────────────────────────────

export async function fetchCustomFoods(
  householdId: string,
  memberId: string
): Promise<CustomFoodItem[]> {
  const { data, error } = await supabase
    .from("custom_foods")
    .select("*")
    .eq("household_id", householdId)
    .or(`scope.eq.household,and(scope.eq.personal,created_by_member_id.eq.${memberId})`);
  if (error) return [];
  return (data ?? []).map((row) => ({
    id: row.id,
    householdId: row.household_id,
    createdByMemberId: row.created_by_member_id,
    name: row.name,
    category: row.category,
    servingName: row.serving_name,
    nutrition: row.nutrition,
    scope: row.scope,
    createdAt: row.created_at,
  }));
}

export async function insertCustomFood(food: Omit<CustomFoodItem, "id" | "createdAt">) {
  const { data, error } = await supabase
    .from("custom_foods")
    .insert({
      household_id: food.householdId,
      created_by_member_id: food.createdByMemberId,
      name: food.name,
      category: food.category,
      serving_name: food.servingName,
      nutrition: food.nutrition,
      scope: food.scope,
    })
    .select("id, created_at")
    .single();
  if (error) throw error;
  return { id: data.id as string, createdAt: data.created_at as string };
}
