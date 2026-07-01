# Fix Custom Food Save - 2 Minutes

## The Problem
Household creation fails → Custom food save fails

## The Fix

**Go here:** https://supabase.com → Your Project → SQL Editor

**Copy and paste this entire SQL block:**

```sql
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "households_insert_authenticated" ON households;
DROP POLICY IF EXISTS "households_select_authenticated" ON households;
DROP POLICY IF EXISTS "households_select_owned" ON households;
DROP POLICY IF EXISTS "households_update_owned" ON households;
CREATE POLICY "households_insert_authenticated" ON households FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "households_select_authenticated" ON households FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "households_select_owned" ON households FOR SELECT USING (id IN (SELECT household_id FROM household_memberships WHERE member_id = auth.uid()::text));
CREATE POLICY "households_update_owned" ON households FOR UPDATE USING (id IN (SELECT household_id FROM household_memberships WHERE member_id = auth.uid()::text)) WITH CHECK (id IN (SELECT household_id FROM household_memberships WHERE member_id = auth.uid()::text));
SELECT policyname FROM pg_policies WHERE tablename = 'households' ORDER BY policyname;
```

**Click Run** (blue button)

## Then Test

1. Clear cache: Cmd+Shift+Delete, click Clear
2. Refresh: Cmd+R
3. Create household - should work now
4. Save custom food - should work now

Done! 🎉
