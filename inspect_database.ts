/**
 * Inspect existing Supabase data before authentication implementation
 * This helps understand what we're working with and how to preserve it
 */

import { supabase } from "./lib/supabase";

async function inspectDatabase() {
  console.log("\n" + "=".repeat(70));
  console.log("DATABASE INSPECTION REPORT");
  console.log("=".repeat(70));

  try {
    // 1. Households
    console.log("\n### HOUSEHOLDS ###");
    const { data: households, error: hErr } = await supabase
      .from("households")
      .select("*");

    if (hErr) {
      console.error("❌ Error fetching households:", hErr);
    } else {
      console.log(`Found ${households?.length ?? 0} household(s)`);
      if (households) {
        households.forEach((h: any) => {
          console.log(`  - ID: ${h.id}`);
          console.log(`    Name: ${h.config?.householdName ?? "N/A"}`);
          console.log(`    Join Code: ${h.join_code ?? "N/A"}`);
          console.log(`    Config Members: ${h.config?.members?.length ?? 0}`);
          h.config?.members?.forEach((m: any) => {
            console.log(`      • ${m.id}: ${m.name}`);
          });
          console.log(`    Created: ${h.created_at}`);
        });
      }
    }

    // 2. Household Memberships
    console.log("\n### HOUSEHOLD MEMBERSHIPS ###");
    const { data: memberships, error: mErr } = await supabase
      .from("household_memberships")
      .select("*");

    if (mErr) {
      console.error("❌ Error fetching memberships:", mErr);
    } else {
      console.log(`Found ${memberships?.length ?? 0} membership row(s)`);
      if (memberships && memberships.length > 0) {
        memberships.forEach((m: any) => {
          console.log(`  - Household: ${m.household_id}`);
          console.log(`    Member ID: ${m.member_id ?? "NULL"}`);
          console.log(`    Device Token: ${m.device_token ?? "NULL"}`);
          console.log(`    Joined: ${m.joined_at}`);
        });
      } else {
        console.log("  ⚠️ No membership rows found");
      }
    }

    // 3. Foods (custom/household-scoped)
    console.log("\n### FOODS (CUSTOM) ###");
    const { data: foods, error: fErr } = await supabase
      .from("foods")
      .select("*")
      .eq("food_type", "household")
      .limit(10);

    if (fErr) {
      console.error("❌ Error fetching foods:", fErr);
    } else {
      console.log(`Found ${foods?.length ?? 0} custom food(s)`);
      if (foods) {
        foods.forEach((f: any) => {
          console.log(`  - Name: ${f.name}`);
          console.log(`    Household ID: ${f.household_id ?? "NULL"}`);
          console.log(`    Created by Member ID: ${f.created_by_member_id ?? "NULL"}`);
          console.log(`    Created: ${f.created_at}`);
        });
      }
    }

    // 4. Day Logs
    console.log("\n### DAY LOGS (RECENT) ###");
    const { data: dayLogs, error: dErr } = await supabase
      .from("day_logs")
      .select("*")
      .limit(5)
      .order("date", { ascending: false });

    if (dErr) {
      console.error("❌ Error fetching day logs:", dErr);
    } else {
      console.log(`Found ${dayLogs?.length ?? 0} day log(s)`);
      if (dayLogs) {
        dayLogs.forEach((d: any) => {
          console.log(`  - Date: ${d.date}`);
          console.log(`    Household: ${d.household_id}`);
          console.log(`    Meal entries: ${Object.keys(d.meals || {}).length}`);
        });
      }
    }

    // 5. Auth users
    console.log("\n### SUPABASE AUTH USERS ###");
    console.log("⚠️ Note: Auth users require admin access to query directly");
    console.log("   Use Supabase dashboard to verify auth setup");

    // 6. Summary
    console.log("\n" + "=".repeat(70));
    console.log("ANALYSIS");
    console.log("=".repeat(70));

    const hasHouseholds = (households?.length ?? 0) > 0;
    const hasMemberships = (memberships?.length ?? 0) > 0;
    const hasFoods = (foods?.length ?? 0) > 0;
    const hasDayLogs = (dayLogs?.length ?? 0) > 0;

    if (!hasHouseholds) {
      console.log("✓ No households yet (fresh start)");
    } else {
      console.log(`✓ ${households!.length} household(s) exists`);

      if (memberships && memberships.length > 0) {
        const nullMembers = memberships.filter(m => !m.member_id || m.member_id === 'null').length;
        if (nullMembers > 0) {
          console.log(`⚠️ ${nullMembers} membership row(s) have NULL/invalid member_id`);
          console.log("   This indicates no authenticated users yet");
        }
      } else {
        console.log("⚠️ Household exists but no membership rows");
        console.log("   This indicates the household was created without auth");
      }

      if (hasFoods) {
        console.log(`✓ ${foods!.length} custom food(s) created`);
        const nullCreators = foods!.filter(f => !f.created_by_member_id ||
                                           f.created_by_member_id.startsWith('member-')).length;
        if (nullCreators > 0) {
          console.log(`⚠️ ${nullCreators} food(s) created with local member IDs (member-1, etc)`);
          console.log("   These will need to be linked to auth.uid() after first login");
        }
      }

      if (hasDayLogs) {
        console.log(`✓ ${dayLogs!.length} day log(s) exist`);
        console.log("   Data will be preserved in migration");
      }
    }

    console.log("\n" + "=".repeat(70));
    console.log("MIGRATION STRATEGY");
    console.log("=".repeat(70));

    if (hasHouseholds && !hasMemberships) {
      console.log("\n🔄 Household exists but not linked to auth:");
      console.log("   1. First user signs up/logs in");
      console.log("   2. Show 'Claim Existing Household' screen");
      console.log("   3. Link user's auth.uid() to household_memberships");
      console.log("   4. Update foods.created_by_member_id to use auth.uid()");
      console.log("   5. Keep day_logs and member profiles unchanged");
    } else if (!hasHouseholds) {
      console.log("\n✓ Fresh start - no migration needed");
      console.log("   Create household on first signup");
    }

  } catch (err) {
    console.error("Fatal error:", err);
  }

  console.log("\n");
}

inspectDatabase().catch(console.error);
