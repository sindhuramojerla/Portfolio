/**
 * Inspect existing Supabase data before authentication implementation
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://gnxbfwomnlfsrxgtplgl.supabase.co";
const serviceRoleKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdueGJmd29tbmxmc3J4Z3RwbGdsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjE4NzY0NCwiZXhwIjoyMDk3NzYzNjQ0fQ.XHsqQpQdKTkO65lFTf2QHFAOHmtM378SYuq2bRmPnOY";

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function inspectDatabase() {
  console.log("\n" + "=".repeat(70));
  console.log("DATABASE INSPECTION REPORT");
  console.log("=".repeat(70));

  try {
    // 1. Auth users
    console.log("\n### SUPABASE AUTH USERS ###");
    const { data: authUsers, error: authErr } = await supabase.auth.admin.listUsers();
    if (authErr) {
      console.error("❌ Error fetching auth users:", authErr);
    } else {
      console.log(`Found ${authUsers?.users?.length ?? 0} auth user(s)`);
      if (authUsers?.users) {
        authUsers.users.forEach((u) => {
          console.log(`  - ID: ${u.id}`);
          console.log(`    Email: ${u.email ?? "N/A"}`);
          console.log(`    Created: ${u.created_at}`);
          console.log(`    Last sign in: ${u.last_sign_in_at ?? "Never"}`);
        });
      }
    }

    // 2. Households
    console.log("\n### HOUSEHOLDS ###");
    const { data: households, error: hErr } = await supabase
      .from("households")
      .select("*");

    if (hErr) {
      console.error("❌ Error fetching households:", hErr);
    } else {
      console.log(`Found ${households?.length ?? 0} household(s)`);
      if (households) {
        households.forEach((h) => {
          console.log(`  - ID: ${h.id}`);
          console.log(`    Name: ${h.config?.householdName ?? "N/A"}`);
          console.log(`    Join Code: ${h.join_code ?? "N/A"}`);
          console.log(`    Config Members: ${h.config?.members?.length ?? 0}`);
          h.config?.members?.forEach((m) => {
            console.log(`      • ${m.id}: ${m.name}`);
          });
          console.log(`    Created: ${h.created_at}`);
        });
      }
    }

    // 3. Household Memberships
    console.log("\n### HOUSEHOLD MEMBERSHIPS ###");
    const { data: memberships, error: mErr } = await supabase
      .from("household_memberships")
      .select("*");

    if (mErr) {
      console.error("❌ Error fetching memberships:", mErr);
    } else {
      console.log(`Found ${memberships?.length ?? 0} membership row(s)`);
      if (memberships && memberships.length > 0) {
        memberships.forEach((m) => {
          console.log(`  - Household: ${m.household_id}`);
          console.log(`    Member ID: ${m.member_id ?? "NULL"}`);
          console.log(`    Device Token: ${m.device_token ?? "NULL"}`);
          console.log(`    Joined: ${m.joined_at}`);
        });
      } else {
        console.log("  ⚠️ No membership rows found");
      }
    }

    // 4. Foods (custom/household-scoped)
    console.log("\n### FOODS (CUSTOM/HOUSEHOLD) ###");
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
        foods.forEach((f) => {
          console.log(`  - Name: ${f.name}`);
          console.log(`    Household ID: ${f.household_id ?? "NULL"}`);
          console.log(`    Created by Member ID: ${f.created_by_member_id ?? "NULL"}`);
          console.log(`    Created: ${f.created_at}`);
        });
      }
    }

    // 5. Day Logs
    console.log("\n### DAY LOGS (RECENT 5) ###");
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
        dayLogs.forEach((d) => {
          console.log(`  - Date: ${d.date}`);
          console.log(`    Household: ${d.household_id}`);
          console.log(`    Meals: ${Object.keys(d.meals || {}).join(", ")}`);
        });
      }
    }

    // 6. Summary
    console.log("\n" + "=".repeat(70));
    console.log("MIGRATION STRATEGY");
    console.log("=".repeat(70));

    const hasHouseholds = (households?.length ?? 0) > 0;
    const hasMemberships = (memberships?.length ?? 0) > 0;
    const hasFoods = (foods?.length ?? 0) > 0;
    const hasDayLogs = (dayLogs?.length ?? 0) > 0;
    const hasAuthUsers = (authUsers?.users?.length ?? 0) > 0;

    if (!hasHouseholds) {
      console.log("\n✓ Fresh start - no data migration needed");
    } else {
      console.log(`\n📦 Existing data found:`);
      if (hasAuthUsers) {
        console.log(`   • ${authUsers.users.length} auth user(s)`);
      }
      console.log(`   • ${households.length} household(s)`);
      if (hasMemberships) {
        console.log(`   • ${memberships.length} membership row(s)`);
      }
      if (hasFoods) {
        console.log(`   • ${foods.length} custom food(s)`);
      }
      if (hasDayLogs) {
        console.log(`   • ${dayLogs.length} day log(s)`);
      }

      if (hasHouseholds && !hasAuthUsers) {
        console.log("\n🔄 Action Required: Household exists but no authenticated users");
        console.log("   1. Existing data created via local member IDs (member-1, member-2, etc)");
        console.log("   2. First user to log in must CLAIM the existing household");
        console.log("   3. Migration will link user's auth.uid() to household_memberships");
        console.log("   4. Custom foods will be linked to auth.uid()");
        console.log("   5. Day logs and meal data will remain unchanged");
      } else if (hasAuthUsers && hasHouseholds) {
        console.log("\n✓ Household already linked to auth user");
      }
    }

  } catch (err) {
    console.error("Fatal error:", err);
  }

  console.log("\n");
  process.exit(0);
}

inspectDatabase().catch((err) => {
  console.error(err);
  process.exit(1);
});
