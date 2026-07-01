# Custom Food Save Failure - Diagnosis Guide

## The Problem

When you try to save a custom food, you get:
1. **"Failed to add user to household_memberships"** - Membership creation fails
2. **"violates foreign key constraint 'foods_household_id_fkey'"** - Household ID doesn't exist

**Root Cause:** The household exists in localStorage but not in Supabase.

## How to Diagnose

### Step 1: Clear Cache & Enable Full Logging

```
1. Press Cmd+Shift+Delete or Ctrl+Shift+Delete
2. Click "Clear"
3. Refresh page
4. Open DevTools (F12)
5. Click "Console" tab
```

### Step 2: Create a Household (Watch Console)

1. Sign up or log in
2. Go through Onboarding
3. Fill in household name (e.g., "Test House")
4. Add members
5. Click "Create Household"

**Look for these logs:**

```
💾 saveHousehold: {
  householdId: "abc12345...",
  name: "Test House"
}
📤 Pushing to Supabase...
Upserting household to database...
✅ Household upserted to database
🔍 Verifying household in Supabase...
✅ Household verified in Supabase
👤 Adding user to household membership...
Adding user to household_memberships...
✅ User membership created
✅ Household saved and linked successfully
```

**If you see errors**, look for:
- `❌ Household upsert failed: ...`
- `❌ Membership insert failed: code=..., message=...`
- `❌ Household was not saved to Supabase: ...`

### Step 3: Note the Exact Error Code

If an error appears, it will show:
```
{
  code: "XXXXX",
  message: "...",
  details: "...",
  hint: "..."
}
```

Write down the **code** and **message**. Common codes:
- **42501** = RLS policy denied access
- **23503** = Foreign key constraint violation
- **23505** = Duplicate key
- **42P01** = Table not found

### Step 4: Check Database Directly

Go to https://supabase.com → Your Project → SQL Editor

**Query 1: Check if household exists**
```sql
SELECT id, config->>'householdName' as name, created_at
FROM households
ORDER BY created_at DESC
LIMIT 1;
```

**Expected:** You see the household you just created

**If empty:** Household was never saved to database
- Check error in Step 2
- Look for "Supabase error" logs

---

**Query 2: Check user membership**
```sql
SELECT * FROM household_memberships
ORDER BY joined_at DESC
LIMIT 1;
```

**Expected:** Row with your household_id and your user_id

**If empty:** Membership was never created
- You have the household but no membership
- Can't save foods without membership

**If error:** RLS blocked the query (you're not a member)
- This is the chicken-and-egg problem we're fixing

---

**Query 3: Check custom foods**
```sql
SELECT id, name, household_id, created_by_member_id
FROM foods
WHERE food_type = 'household'
ORDER BY created_at DESC
LIMIT 5;
```

**Expected:** No rows (you haven't saved yet)

**If you see an error:** RLS is blocking (expected if no membership)

---

### Step 5: Try Saving Custom Food (Watch Console)

1. Click a meal
2. Click "Create New Food"
3. Fill in: Name, Type, Serving, Calories
4. Save Mode: "Save as Household Food"
5. Click "Add"

**Look for:**
```
🍽️ Saving custom food to foods table: {
  foodCode: "custom_abc12345",
  householdId: "abc12345...",
  createdByMemberId: "def67890..."
}
🔐 Auth state: {
  userId: "def67890...",
  authenticated: true
}
🔍 Validating custom food preconditions...
✅ Household exists
✅ User has membership
✅ Food saved to foods table: {
  id: "food_uuid",
  created_at: "2026-07-01..."
}
✅ Custom food saved successfully!
```

**If you see errors:**
- `❌ Precondition failed: Household does not exist in database` → Household wasn't saved
- `❌ Precondition failed: You are not a member of this household` → Membership didn't create
- `❌ Membership insert failed: ...` → RLS or constraint issue

---

## Possible Scenarios

### Scenario A: Household Not Saved to Supabase

**Symptoms:**
- See "Household upserted to database" ✅
- BUT "Verifying household in Supabase..." fails
- Database Query 1 is empty

**Cause:** `upsertHousehold()` succeeded but household not actually in DB

**Actions:**
1. Check Supabase RLS policies on `households` table
2. Verify you're authenticated (check auth state)
3. Check user has INSERT permission

---

### Scenario B: Membership Won't Create

**Symptoms:**
- Household exists in DB (Query 1 shows it)
- But "Adding user to household membership..." fails
- Error: code=23503 (foreign key) or code=42501 (RLS)

**Cause:** Foreign key constraint or RLS policy blocking

**Actions:**
1. If code=23503: The household_id is invalid or wrong format
2. If code=42501: RLS policy `household_memberships_insert_with_code` missing
3. Check household_memberships table RLS policies

---

### Scenario C: Custom Food Won't Insert

**Symptoms:**
- Household exists (Query 1 ✅)
- Membership exists (Query 2 ✅)
- But custom food insert fails
- Error: "violates foreign key constraint 'foods_household_id_fkey'"

**Cause:** Precondition check failed or RLS blocking

**Actions:**
1. Check `foods` table has RLS `foods_insert_household` policy
2. Verify household_id format matches
3. Run Query 3 to check if you can see foods table

---

## What to Report

When you hit an error, provide:

1. **Console logs** - Copy the error section:
   ```
   ❌ [error message]
   {code: "...", message: "...", details: "...", hint: "..."}
   ```

2. **Database state** - Run the 3 queries above and show:
   - Does household exist?
   - Does membership exist?
   - Can you see foods table?

3. **Error code** - The 5-digit code (42501, 23503, etc.)

4. **What step failed:**
   - Household creation?
   - Membership creation?
   - Food insert?

---

## Testing After Fix

Once we fix the issue:

1. **Create household** - Should see all ✅ in console
2. **Verify in database** - Run Query 1 & 2 (should have rows)
3. **Save custom food** - Should see food saved and appear in app
4. **Refresh page** - Food should still be there (persisted)
5. **Check database** - Query 3 should show your food

If all ✅, the fix is working!

---

## If Nothing Works

Worst case: We migrate the existing localStorage household to Supabase safely:

1. Export household config from localStorage
2. Create matching household in Supabase
3. Create membership row
4. Persist the real Supabase UUID
5. Delete localStorage version
6. Retry custom food save

**This preserves all data** - members, nutrition goals, day logs.
