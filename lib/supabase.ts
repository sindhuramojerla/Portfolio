import { createClient } from "@supabase/supabase-js";
import { CustomFoodItem, HouseholdFoodPref, SupabaseFood, HouseholdConfig } from "./types";

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

/**
 * Join a household using a join code (calls secure RPC)
 */
export async function joinHouseholdWithCode(
  joinCode: string
): Promise<{ success: boolean; householdId?: string; error?: string }> {
  const { data, error } = await supabase.rpc("join_household_secure", {
    p_join_code_plain: joinCode.toUpperCase().trim(),
  });

  if (error) {
    return { success: false, error: error.message };
  }

  if (data && data.success) {
    return { success: true, householdId: data.household_id };
  }

  return { success: false, error: data?.error_message || "Join failed" };
}

/**
 * Get the current user's households
 */
export async function fetchUserHouseholds() {
  const { data, error } = await supabase
    .from("household_memberships")
    .select(
      `
      household_id,
      households!inner (
        id, join_code_hash, config, created_at, updated_at
      )
    `
    );

  if (error) return [];

  return (data ?? []).map((m: any) => ({
    id: m.households.id,
    joinCode: m.households.join_code_hash,
    config: m.households.config,
  }));
}

/**
 * Get all households that exist (for finding unclaimed ones)
 * Requires "households_select_authenticated" RLS policy to allow discovery
 */
export async function fetchAllHouseholds() {
  try {
    const { data, error } = await supabase
      .from("households")
      .select("id, config, created_at");

    if (error) {
      // RLS policy might be blocking - this is expected on first login
      // See FIX_HOUSEHOLD_DISCOVERY.md if you see this error
      console.debug("Could not fetch all households (RLS policy may be blocking discovery):", error.message);
      return [];
    }

    if (!data || data.length === 0) {
      console.debug("No households found in database");
      return [];
    }

    return data.map((h: any) => ({
      id: h.id,
      config: h.config as HouseholdConfig,
      createdAt: h.created_at,
    }));
  } catch (err) {
    console.error("Unexpected error fetching households:", err);
    return [];
  }
}

/**
 * Claim an existing household for the current authenticated user
 * Creates a membership entry linking auth.uid() to the household
 */
export async function claimHousehold(householdId: string) {
  try {
    // Get current user
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session?.user?.id) {
      throw new Error("Not authenticated");
    }

    // Create membership entry
    const { error: membershipError } = await supabase
      .from("household_memberships")
      .upsert(
        {
          household_id: householdId,
          member_id: session.user.id,
        },
        { onConflict: "household_id,member_id" }
      );

    if (membershipError) {
      throw membershipError;
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to claim household";
    console.error("claimHousehold error:", err);
    return { success: false, error: message };
  }
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

// ── SIMPLER APPROACH: Save custom foods directly to foods table ──
// This leverages the existing foods table RLS which already works

export async function saveCustomFoodToFoods(food: {
  householdId: string;
  createdByMemberId: string;
  name: string;
  category: string;
  servingName: string;
  nutrition: Nutrition;
}) {
  const { v4: uuidv4 } = await import("uuid");
  const foodCode = `custom_${uuidv4().slice(0, 8)}`;

  console.log("🍽️ Saving custom food to foods table:", {
    foodCode,
    name: food.name,
    householdId: food.householdId,
  });

  try {
    const { data, error } = await supabase
      .from("foods")
      .insert({
        food_code: foodCode,
        name: food.name,
        category: food.category as any,
        default_serving_qty: 1,
        default_serving_unit: food.servingName,
        allowed_units: [food.servingName, "gram"],
        calories: food.nutrition.calories,
        protein: food.nutrition.protein,
        carbs: food.nutrition.carbs,
        fibre: food.nutrition.fibre,
        fat: food.nutrition.fat,
        portion_presets: [{ qty: 1, label: `1 ${food.servingName}` }],
        household_id: food.householdId,
        created_by_member_id: food.createdByMemberId,
        food_type: "household",
        confidence: "custom" as any,
        is_active: true,
      })
      .select("id, created_at")
      .single();

    if (error) {
      console.error("❌ Supabase error:", error);
      throw new Error(error.message || "Failed to save food");
    }

    if (!data) {
      throw new Error("No data returned from insert");
    }

    console.log("✅ Custom food saved to foods table:", data);
    return { id: data.id as string, createdAt: data.created_at as string };
  } catch (err) {
    console.error("🔥 Error saving custom food:", err);
    throw err;
  }
}

// ── DEPRECATED: Old custom_foods approach (keeping for reference) ──
export async function insertCustomFood(food: Omit<CustomFoodItem, "id" | "createdAt">) {
  return saveCustomFoodToFoods({
    householdId: food.householdId,
    createdByMemberId: food.createdByMemberId,
    name: food.name,
    category: food.category,
    servingName: food.servingName,
    nutrition: food.nutrition,
  });
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
