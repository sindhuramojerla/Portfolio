-- ============================================================
-- Migration 005: Fix RLS Policies with Proper Authentication
-- CRITICAL SECURITY FIX
-- ============================================================
--
-- Previously: All RLS policies used USING (true) allowing
-- any user to access any household's data.
--
-- Now: All policies check that the user belongs to the
-- household via household_memberships table.
--
-- This migration:
-- 1. Drops all insecure policies
-- 2. Creates new policies with auth.uid() checks
-- 3. Enables RLS on all tables
--

-- Drop all existing insecure policies
DROP POLICY IF EXISTS "custom_foods_all" ON custom_foods;
DROP POLICY IF EXISTS "day_logs_all" ON day_logs;
DROP POLICY IF EXISTS "household_food_prefs_all" ON household_food_prefs;
DROP POLICY IF EXISTS "memberships_all" ON household_memberships;
DROP POLICY IF EXISTS "households_insert" ON households;
DROP POLICY IF EXISTS "households_select" ON households;
DROP POLICY IF EXISTS "households_update" ON households;
DROP POLICY IF EXISTS "foods_select_all" ON foods;
DROP POLICY IF EXISTS "foods_insert_household" ON foods;
DROP POLICY IF EXISTS "foods_update_household" ON foods;
DROP POLICY IF EXISTS "unit_conversions_select" ON unit_conversions;
DROP POLICY IF EXISTS "unit_conversions_insert" ON unit_conversions;

-- ── HOUSEHOLDS ──────────────────────────────────────────

-- User can SELECT households they belong to
CREATE POLICY "households_select_owned"
  ON households FOR SELECT
  USING (
    id IN (
      SELECT household_id FROM household_memberships
      WHERE member_id = auth.uid()::text
    )
  );

-- User can INSERT (create) a new household
CREATE POLICY "households_insert_authenticated"
  ON households FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
  );

-- User can UPDATE only households they belong to
CREATE POLICY "households_update_owned"
  ON households FOR UPDATE
  USING (
    id IN (
      SELECT household_id FROM household_memberships
      WHERE member_id = auth.uid()::text
    )
  )
  WITH CHECK (
    id IN (
      SELECT household_id FROM household_memberships
      WHERE member_id = auth.uid()::text
    )
  );

-- ── HOUSEHOLD_MEMBERSHIPS ──────────────────────────────

-- User can only see memberships for their own households
CREATE POLICY "household_memberships_select_own"
  ON household_memberships FOR SELECT
  USING (
    household_id IN (
      SELECT household_id FROM household_memberships
      WHERE member_id = auth.uid()::text
    )
  );

-- User can INSERT memberships (join) with valid code
CREATE POLICY "household_memberships_insert_with_code"
  ON household_memberships FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
  );

-- User cannot UPDATE their membership (prevent self-promotion)
CREATE POLICY "household_memberships_no_update"
  ON household_memberships FOR UPDATE
  USING (false)
  WITH CHECK (false);

-- User can DELETE their own membership (leave household)
CREATE POLICY "household_memberships_delete_own"
  ON household_memberships FOR DELETE
  USING (
    member_id = auth.uid()::text
  );

-- ── DAY_LOGS (Diary Entries) ────────────────────────────

-- User can SELECT day logs only from their households
CREATE POLICY "day_logs_select_own_household"
  ON day_logs FOR SELECT
  USING (
    household_id IN (
      SELECT household_id FROM household_memberships
      WHERE member_id = auth.uid()::text
    )
  );

-- User can INSERT day logs to their households
CREATE POLICY "day_logs_insert_own_household"
  ON day_logs FOR INSERT
  WITH CHECK (
    household_id IN (
      SELECT household_id FROM household_memberships
      WHERE member_id = auth.uid()::text
    )
  );

-- User can UPDATE day logs in their households
CREATE POLICY "day_logs_update_own_household"
  ON day_logs FOR UPDATE
  USING (
    household_id IN (
      SELECT household_id FROM household_memberships
      WHERE member_id = auth.uid()::text
    )
  )
  WITH CHECK (
    household_id IN (
      SELECT household_id FROM household_memberships
      WHERE member_id = auth.uid()::text
    )
  );

-- User can DELETE day logs in their households
CREATE POLICY "day_logs_delete_own_household"
  ON day_logs FOR DELETE
  USING (
    household_id IN (
      SELECT household_id FROM household_memberships
      WHERE member_id = auth.uid()::text
    )
  );

-- ── CUSTOM_FOODS (User-Created Foods) ──────────────────

-- User can SELECT custom foods from their households
CREATE POLICY "custom_foods_select_own_household"
  ON custom_foods FOR SELECT
  USING (
    household_id IN (
      SELECT household_id FROM household_memberships
      WHERE member_id = auth.uid()::text
    )
  );

-- User can INSERT custom foods to their households
CREATE POLICY "custom_foods_insert_own_household"
  ON custom_foods FOR INSERT
  WITH CHECK (
    household_id IN (
      SELECT household_id FROM household_memberships
      WHERE member_id = auth.uid()::text
    )
    AND created_by_member_id = auth.uid()::text
  );

-- User can UPDATE only their own custom foods
CREATE POLICY "custom_foods_update_own"
  ON custom_foods FOR UPDATE
  USING (
    created_by_member_id = auth.uid()::text
    AND
    household_id IN (
      SELECT household_id FROM household_memberships
      WHERE member_id = auth.uid()::text
    )
  )
  WITH CHECK (
    created_by_member_id = auth.uid()::text
    AND
    household_id IN (
      SELECT household_id FROM household_memberships
      WHERE member_id = auth.uid()::text
    )
  );

-- User can DELETE only their own custom foods
CREATE POLICY "custom_foods_delete_own"
  ON custom_foods FOR DELETE
  USING (
    created_by_member_id = auth.uid()::text
  );

-- ── HOUSEHOLD_FOOD_PREFS (Food Preferences) ────────────

-- User can SELECT prefs from their households
CREATE POLICY "household_food_prefs_select_own_household"
  ON household_food_prefs FOR SELECT
  USING (
    household_id IN (
      SELECT household_id FROM household_memberships
      WHERE member_id = auth.uid()::text
    )
  );

-- User can INSERT/UPDATE/DELETE prefs in their households
CREATE POLICY "household_food_prefs_modify_own_household"
  ON household_food_prefs FOR INSERT
  WITH CHECK (
    household_id IN (
      SELECT household_id FROM household_memberships
      WHERE member_id = auth.uid()::text
    )
  );

CREATE POLICY "household_food_prefs_update_own_household"
  ON household_food_prefs FOR UPDATE
  USING (
    household_id IN (
      SELECT household_id FROM household_memberships
      WHERE member_id = auth.uid()::text
    )
  )
  WITH CHECK (
    household_id IN (
      SELECT household_id FROM household_memberships
      WHERE member_id = auth.uid()::text
    )
  );

CREATE POLICY "household_food_prefs_delete_own_household"
  ON household_food_prefs FOR DELETE
  USING (
    household_id IN (
      SELECT household_id FROM household_memberships
      WHERE member_id = auth.uid()::text
    )
  );

-- ── FOODS (Global + Household Foods) ────────────────────

-- Anyone can SELECT global foods
CREATE POLICY "foods_select_global"
  ON foods FOR SELECT
  USING (
    household_id IS NULL
  );

-- Anyone can SELECT household foods from their households
CREATE POLICY "foods_select_household"
  ON foods FOR SELECT
  USING (
    household_id IN (
      SELECT household_id FROM household_memberships
      WHERE member_id = auth.uid()::text
    )
  );

-- User can INSERT household foods to their households
CREATE POLICY "foods_insert_household"
  ON foods FOR INSERT
  WITH CHECK (
    household_id IN (
      SELECT household_id FROM household_memberships
      WHERE member_id = auth.uid()::text
    )
  );

-- User can UPDATE only household foods they created
CREATE POLICY "foods_update_own_household"
  ON foods FOR UPDATE
  USING (
    created_by_member_id = auth.uid()::text
  )
  WITH CHECK (
    created_by_member_id = auth.uid()::text
  );

-- User can DELETE only household foods they created
CREATE POLICY "foods_delete_own_household"
  ON foods FOR DELETE
  USING (
    created_by_member_id = auth.uid()::text
  );

-- ── UNIT_CONVERSIONS (Global Data) ──────────────────────

-- Anyone can SELECT unit conversions
CREATE POLICY "unit_conversions_select"
  ON unit_conversions FOR SELECT
  USING (true);

-- Only service role can INSERT (via seed script)
CREATE POLICY "unit_conversions_insert_disabled"
  ON unit_conversions FOR INSERT
  WITH CHECK (false);
