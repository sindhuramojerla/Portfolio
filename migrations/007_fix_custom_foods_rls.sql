-- ============================================================
-- Migration 007: Fix Custom Foods RLS Circular Reference
-- ============================================================
--
-- The custom_foods policies were causing infinite recursion
-- when checking household_memberships. Simplify by:
-- 1. Allow reading own custom foods (by member_id)
-- 2. Allow inserting if authenticated
-- 3. Allow updating/deleting own foods only
--

-- Drop problematic policies
DROP POLICY IF EXISTS "custom_foods_select_own_household" ON custom_foods;
DROP POLICY IF EXISTS "custom_foods_insert_own_household" ON custom_foods;
DROP POLICY IF EXISTS "custom_foods_update_own" ON custom_foods;
DROP POLICY IF EXISTS "custom_foods_delete_own" ON custom_foods;

-- Enable RLS
ALTER TABLE custom_foods ENABLE ROW LEVEL SECURITY;

-- Simple policy: Users can SELECT their own custom foods
CREATE POLICY "custom_foods_select_own"
  ON custom_foods FOR SELECT
  USING (created_by_member_id = auth.uid()::text);

-- Users can INSERT custom foods (authenticated only)
CREATE POLICY "custom_foods_insert"
  ON custom_foods FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Users can UPDATE only their own custom foods
CREATE POLICY "custom_foods_update_own"
  ON custom_foods FOR UPDATE
  USING (created_by_member_id = auth.uid()::text)
  WITH CHECK (created_by_member_id = auth.uid()::text);

-- Users can DELETE only their own custom foods
CREATE POLICY "custom_foods_delete_own"
  ON custom_foods FOR DELETE
  USING (created_by_member_id = auth.uid()::text);
