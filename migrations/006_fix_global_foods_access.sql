-- ============================================================
-- Migration 006: Fix Global Foods Access for Unauthenticated Users
-- ============================================================
--
-- Ensure that global foods (household_id IS NULL) can be read
-- by anyone, including unauthenticated users
--

-- First, ensure RLS is enabled on the foods table
ALTER TABLE foods ENABLE ROW LEVEL SECURITY;

-- Drop the previous policies if they exist
DROP POLICY IF EXISTS "foods_select_global" ON foods;
DROP POLICY IF EXISTS "foods_select_household" ON foods;
DROP POLICY IF EXISTS "foods_insert_household" ON foods;
DROP POLICY IF EXISTS "foods_update_own_household" ON foods;
DROP POLICY IF EXISTS "foods_delete_own_household" ON foods;

-- ── FOODS: Allow global food reads for everyone ──────────

-- Anyone (authenticated or not) can SELECT global foods
CREATE POLICY "foods_select_global"
  ON foods FOR SELECT
  USING (
    household_id IS NULL
  );

-- Authenticated users can SELECT household foods from their households
CREATE POLICY "foods_select_household"
  ON foods FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND
    household_id IN (
      SELECT household_id FROM household_memberships
      WHERE member_id = auth.uid()::text
    )
  );

-- Authenticated users can INSERT household foods to their households
CREATE POLICY "foods_insert_household"
  ON foods FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND
    household_id IN (
      SELECT household_id FROM household_memberships
      WHERE member_id = auth.uid()::text
    )
  );

-- Authenticated users can UPDATE only household foods they created
CREATE POLICY "foods_update_own_household"
  ON foods FOR UPDATE
  USING (
    auth.role() = 'authenticated'
    AND
    created_by_member_id = auth.uid()::text
  )
  WITH CHECK (
    auth.role() = 'authenticated'
    AND
    created_by_member_id = auth.uid()::text
  );

-- Authenticated users can DELETE only household foods they created
CREATE POLICY "foods_delete_own_household"
  ON foods FOR DELETE
  USING (
    auth.role() = 'authenticated'
    AND
    created_by_member_id = auth.uid()::text
  );
