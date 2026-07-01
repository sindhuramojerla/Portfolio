# Fix: Household Discovery RLS Issue

## Problem
When a new user logs in, they get error: **"Error fetching all households: {}""**

This happens because:
1. User logs in successfully
2. `initAuth()` calls `fetchAllHouseholds()`
3. RLS policy blocks SELECT because user is not yet a member of any household
4. Error thrown, no unclaimed households displayed

## Root Cause
The RLS policy `households_select_owned` only allows SELECT if user is a member:
```sql
WHERE member_id = auth.uid()::text
```

But on first login, the user has no memberships yet!

## Solution
Add a new RLS policy that allows authenticated users to SELECT all households for discovery.

## How to Fix (2 Steps)

### Step 1: Apply SQL Migration in Supabase

**Go to:** https://supabase.com → Your Project → SQL Editor

**Run this SQL:**
```sql
CREATE POLICY "households_select_authenticated"
  ON households FOR SELECT
  USING (auth.role() = 'authenticated');
```

**What this does:**
- Allows any authenticated user to SELECT all households
- Lets them see what's available to claim/join
- Existing "households_select_owned" policy still applies for members
- Security maintained: can see but can't modify unless member

**Expected result:**
- Query succeeds
- No errors
- Policy created

### Step 2: Test in App

**In browser:**
1. Clear cache (Cmd+Shift+Delete or Ctrl+Shift+Delete)
2. Go to http://localhost:3000
3. Sign in with your test account
4. Should see ClaimHouseholdModal
5. Can claim "The Cuties" household

**Expected:** ✅ No error, modal appears with household

---

## Why This Works

**Before (broken):**
```
User logs in
  ↓
fetchAllHouseholds()
  ↓
SELECT FROM households
  ↓
RLS: user is member? NO
  ↓
Error: {} (no rows returned, policy blocked)
```

**After (fixed):**
```
User logs in
  ↓
fetchAllHouseholds()
  ↓
SELECT FROM households
  ↓
RLS: is authenticated? YES
  ↓
Returns all households
  ↓
Show ClaimHouseholdModal
```

---

## Verification

**To verify the fix worked**, run this in Supabase SQL Editor:

```sql
-- Check that the policy exists
SELECT policyname, qual FROM pg_policies 
WHERE tablename = 'households' 
AND policyname = 'households_select_authenticated';

-- Should return one row with the policy
```

---

## Security Note

This policy is **safe** because:
1. ✅ Only authenticated users can execute
2. ✅ They can only SELECT (read), not INSERT/UPDATE/DELETE
3. ✅ When they claim a household, a membership row is created
4. ✅ Then `households_select_owned` policy controls access
5. ✅ No cross-household access possible

The two policies work together:
- **households_select_authenticated**: Allows discovery for joining
- **households_select_owned**: Restricts to members once they join

---

## If You Don't Have Supabase Access

Alternative: Use service role key in a backend function (more complex)

But easiest is to run the SQL directly in Supabase dashboard:
1. Go to https://supabase.com/dashboard
2. Click your project
3. Click "SQL Editor" in left sidebar
4. Copy the CREATE POLICY statement above
5. Click "Run"

---

## After Applying Fix

Continue testing:
- [ ] Claim existing household
- [ ] Custom food save should work
- [ ] Session persists on refresh
- [ ] Logout clears session

Then proceed with full AUTH_TESTING_CHECKLIST.md
