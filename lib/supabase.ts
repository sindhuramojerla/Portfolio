import { createClient } from "@supabase/supabase-js";
import { CustomFoodItem, HouseholdFoodPref, SupabaseFood } from "./types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, key);

// ─── Join codes ───────────────────────────────────────────────────────────────

export function generateJoinCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "HP";
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// ─── Households ───────────────────────────────────────────────────────────────

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

// ─── Day logs ─────────────────────────────────────────────────────────────────

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

// ─── Foods (new Supabase-backed catalogue) ────────────────────────────────────

/**
 * Fetch all active foods visible to a household:
 * - Global foods (household_id IS NULL)
 * - Household-specific foods (household_id = householdId)
 */
export async function fetchFoods(householdId?: string): Promise<SupabaseFood[]> {
  let query = supabase
    .from("foods")
    .select("*")
    .eq("is_active", true)
    .order("category")
    .order("name");

  if (householdId) {
    query = query.or(`household_id.is.null,household_id.eq.${householdId}`);
  } else {
    query = query.is("household_id", null);
  }

  const { data, error } = await query;
  if (error) {
    console.error("fetchFoods error:", error);
    return [];
  }

  return (data ?? []).map(rowToSupabaseFood);
}

function rowToSupabaseFood(row: Record<string, unknown>): SupabaseFood {
  return {
    id:                    row.id as string,
    food_code:             row.food_code as string,
    name:                  row.name as string,
    aliases:               (row.aliases as string[]) ?? [],
    category:              row.category as SupabaseFood["category"],
    food_type:             row.food_type as SupabaseFood["food_type"],
    default_serving_qty:   Number(row.default_serving_qty),
    default_serving_unit:  row.default_serving_unit as SupabaseFood["default_serving_unit"],
    allowed_units:         ((row.allowed_units as string[]) ?? []) as SupabaseFood["allowed_units"],
    grams_per_default_unit: row.grams_per_default_unit != null ? Number(row.grams_per_default_unit) : null,
    calories:              Number(row.calories),
    protein:               Number(row.protein),
    carbs:                 Number(row.carbs),
    fibre:                 Number(row.fibre),
    fat:                   Number(row.fat),
    portion_presets:       (row.portion_presets as SupabaseFood["portion_presets"]) ?? [],
    preparation_options:   (row.preparation_options as SupabaseFood["preparation_options"]) ?? [],
    allowed_additions:     (row.allowed_additions as string[]) ?? [],
    confidence:            row.confidence as SupabaseFood["confidence"],
    source_notes:          row.source_notes as string | null,
    is_active:             Boolean(row.is_active),
    household_id:          row.household_id as string | null,
    created_by_member_id:  row.created_by_member_id as string | null,
  };
}

/** Insert a household-scoped food into the foods table */
export async function insertHouseholdFood(
  food: Omit<SupabaseFood, "id" | "is_active">,
  householdId: string,
  createdByMemberId: string
): Promise<string> {
  const { data, error } = await supabase
    .from("foods")
    .insert({
      food_code:              `household-${householdId}-${Date.now()}`,
      name:                   food.name,
      aliases:                food.aliases,
      category:               food.category,
      food_type:              "household",
      default_serving_qty:    food.default_serving_qty,
      default_serving_unit:   food.default_serving_unit,
      allowed_units:          food.allowed_units,
      grams_per_default_unit: food.grams_per_default_unit,
      calories:               food.calories,
      protein:                food.protein,
      carbs:                  food.carbs,
      fibre:                  food.fibre,
      fat:                    food.fat,
      portion_presets:        food.portion_presets,
      preparation_options:    food.preparation_options,
      allowed_additions:      food.allowed_additions,
      confidence:             food.confidence,
      household_id:           householdId,
      created_by_member_id:   createdByMemberId,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

// ─── Household food preferences ───────────────────────────────────────────────

export async function fetchHouseholdFoodPrefs(
  householdId: string
): Promise<HouseholdFoodPref[]> {
  const { data, error } = await supabase
    .from("household_food_prefs")
    .select("*")
    .eq("household_id", householdId);
  if (error) return [];
  return (data ?? []) as HouseholdFoodPref[];
}

export async function upsertHouseholdFoodPref(
  pref: Omit<HouseholdFoodPref, "id">
): Promise<void> {
  const { error } = await supabase
    .from("household_food_prefs")
    .upsert(pref, { onConflict: "household_id,food_id" });
  if (error) throw error;
}

// ─── Custom foods (legacy table, kept for backward compat) ────────────────────

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
    id:                  row.id,
    householdId:         row.household_id,
    createdByMemberId:   row.created_by_member_id,
    name:                row.name,
    category:            row.category,
    servingName:         row.serving_name,
    nutrition:           row.nutrition,
    scope:               row.scope,
    createdAt:           row.created_at,
  }));
}

export async function insertCustomFood(food: Omit<CustomFoodItem, "id" | "createdAt">) {
  const { data, error } = await supabase
    .from("custom_foods")
    .insert({
      household_id:          food.householdId,
      created_by_member_id:  food.createdByMemberId,
      name:                  food.name,
      category:              food.category,
      serving_name:          food.servingName,
      nutrition:             food.nutrition,
      scope:                 food.scope,
    })
    .select("id, created_at")
    .single();
  if (error) throw error;
  return { id: data.id as string, createdAt: data.created_at as string };
}

// ─── Household memberships (multi-household support) ──────────────────────────

export async function recordMembership(
  householdId: string,
  deviceToken: string,
  memberId: string
): Promise<void> {
  await supabase
    .from("household_memberships")
    .upsert({ household_id: householdId, device_token: deviceToken, member_id: memberId },
             { onConflict: "household_id,device_token" });
}

export async function fetchMemberships(deviceToken: string) {
  const { data } = await supabase
    .from("household_memberships")
    .select("household_id, member_id, joined_at")
    .eq("device_token", deviceToken);
  return data ?? [];
}
