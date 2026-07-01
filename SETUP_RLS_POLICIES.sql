-- PASTE THIS IN SUPABASE SQL EDITOR AND RUN IT
-- This sets up all required RLS policies for household creation to work

-- 1. Enable RLS on households table
ALTER TABLE households ENABLE ROW LEVEL SECURITY;

-- 2. Drop old policies if they exist (safe - won't error if they don't)
DROP POLICY IF EXISTS "households_insert_authenticated" ON households;
DROP POLICY IF EXISTS "households_select_authenticated" ON households;
DROP POLICY IF EXISTS "households_select_owned" ON households;
DROP POLICY IF EXISTS "households_update_owned" ON households;

-- 3. CREATE: Authenticated users can INSERT households
CREATE POLICY "households_insert_authenticated"
  ON households FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- 4. CREATE: Authenticated users can SELECT all households (for discovery/joining)
CREATE POLICY "households_select_authenticated"
  ON households FOR SELECT
  USING (auth.role() = 'authenticated');

-- 5. CREATE: Users can SELECT households they own
CREATE POLICY "households_select_owned"
  ON households FOR SELECT
  USING (
    id IN (
      SELECT household_id FROM household_memberships
      WHERE member_id = auth.uid()::text
    )
  );

-- 6. CREATE: Users can UPDATE households they own
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

-- Verify policies are in place
SELECT policyname, qual FROM pg_policies
WHERE tablename = 'households'
ORDER BY policyname;
