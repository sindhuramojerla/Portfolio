# Check RLS Setup for Households Table

If custom food save is failing with "Household does not exist in database", the likely issue is:

**The `households` table INSERT policy is missing or wrong**

## Required RLS Policies

Run this in Supabase SQL Editor to see what policies exist:

```sql
SELECT schemaname, tablename, policyname, qual, with_check
FROM pg_policies
WHERE tablename = 'households'
ORDER BY policyname;
```

You should see:
- `households_select_authenticated` - SELECT (created in Migration 008)
- `households_select_owned` - SELECT (created in Migration 005)
- `households_insert_authenticated` - INSERT (created in Migration 005)
- `households_update_owned` - UPDATE (created in Migration 005)

## If INSERT Policy is Missing

Run this to add it:

```sql
CREATE POLICY "households_insert_authenticated"
  ON households FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
```

## If All Policies Exist

Then the issue is likely **authentication state**. The household INSERT requires:
```sql
WITH CHECK (auth.role() = 'authenticated')
```

This means: Only authenticated users can insert.

**Check:**
1. Is user authenticated when creating household?
2. Is auth.role() returning 'authenticated'?

## Debug Steps

1. **Clear cache & refresh**
   ```
   Cmd+Shift+Delete or Ctrl+Shift+Delete
   Refresh (Cmd+R or Ctrl+R)
   ```

2. **Open Console (F12)**

3. **Try creating household again**

4. **Look for logs:**
   ```
   💾 saveHousehold START: {
     householdId: "...",
     authenticated: true,  ← Should be true
     userId: "..."
   }
   ```

5. **If authenticated=false:** User is not logged in when creating household
   - This means `currentUserId` is null
   - RLS policy blocks INSERT (requires authenticated role)
   - Household insert fails

6. **If authenticated=true:** The RLS policy should allow it
   - Check that the policy exists (query above)
   - Check for other errors in console logs

## Common Error Codes

If you see an error after upsertHousehold, note the code:

- **42501** = RLS policy denied (user not authenticated or policy missing)
- **23505** = Duplicate key (household ID already exists)
- **23503** = Foreign key constraint (shouldn't happen for households)

## Next Steps

1. Check RLS policies exist (run the SELECT query above)
2. Create missing policies if needed
3. Clear cache and try again
4. Watch console for error code and message
5. Report back with the exact error

---

## Example: If Policy is Missing

```sql
-- Check if policies exist
SELECT policyname FROM pg_policies 
WHERE tablename = 'households';

-- If households_insert_authenticated is missing, add it:
CREATE POLICY "households_insert_authenticated"
  ON households FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Then clear browser cache and try again
```
