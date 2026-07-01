# HomePlate Authentication Implementation Summary

## Overview

This document summarizes the authentication implementation for HomePlate, converting from a device-token-based access model to Supabase Auth with proper RLS enforcement.

## Current Database State

**Before Implementation:**
- 2 households with local member IDs (UUIDs)
- 0 authenticated Supabase Auth users
- household_memberships rows with local member IDs and device tokens
- RLS policies written to expect `auth.uid()` but never enforced (auth.uid() was NULL)

**After Implementation:**
- Existing households preserved unchanged
- household_memberships updated with auth.uid() when user claims household
- Custom foods stored with auth.uid() as creator
- RLS policies now enforce access control

## Implementation Phases

### Phase 1: Wire Authentication into App Startup ✅

**Files Changed:**
- `lib/store.ts` - Added `authInitialized`, `authLoading` state and proper cleanup
- `app/page.tsx` - NEW: Auth gating entry point
- `app/main.tsx` - MOVED from `app/page.tsx` (main app logic)
- `components/AuthLoading.tsx` - NEW: Loading screen during session check

**How It Works:**
1. App loads → `app/page.tsx`
2. `authLoading=true` while Supabase checks session
3. `initAuth()` sets up `onAuthStateChange` listener
4. If authenticated: show `<MainApp />`
5. If not authenticated: show `<Auth />` (login/signup)
6. If persistent session exists: user auto-logged in
7. Browser refresh preserves session

**Key Code:**
```typescript
// store.ts
initAuth: () => {
  const unsubscribe = onAuthStateChange(async (session) => {
    const userId = session?.user?.id ?? null;
    set((s) => ({ 
      currentUserId: userId, 
      authLoading: false, 
      authInitialized: true 
    }));
    // Load households for authenticated user
  });
  return unsubscribe; // Cleanup function
};
```

### Phase 2: Household Claim & Migration ✅

**Files Changed:**
- `lib/supabase.ts` - Added `fetchAllHouseholds()`, `claimHousehold()`
- `lib/store.ts` - Added `unclaimedHouseholds` state, `claimHousehold()` action
- `components/ClaimHouseholdModal.tsx` - NEW: UI to claim existing household
- `app/main.tsx` - Show claim modal when unclaimed households exist

**How It Works:**
1. User logs in for first time
2. `initAuth` calls `fetchUserHouseholds()` → empty (no memberships yet)
3. `initAuth` calls `fetchAllHouseholds()` → finds existing households
4. `unclaimedHouseholds` populated with existing households
5. `ClaimHouseholdModal` shows the first unclaimed household
6. User clicks "Claim"
7. `claimHousehold()` creates `household_memberships` row with:
   - `household_id` = existing household ID
   - `member_id` = auth.uid() (authenticated user)
8. User now has RLS-checked access to household

**What's Preserved:**
- Household name, member profiles, nutrition goals (all in `config`)
- Local member IDs remain unchanged (used for nutrition tracking)
- Day logs and existing meal data unchanged
- All existing data survives migration

**RLS Now Works:**
```sql
-- household_memberships check
WHERE member_id = auth.uid()::text
-- auth.uid() now equals user's actual Supabase UUID
```

### Phase 3: Fix Custom Food Ownership ✅

**Files Changed:**
- `components/AddFoodSheet.tsx` - Pass `currentUserId` instead of `member.id` to custom food save

**The Problem:**
- Code was: `createdByMemberId: member.id` (local member ID like "56a87677...")
- RLS policy checks: `created_by_member_id = auth.uid()::text` (auth user UUID)
- Insert failed because NULL ≠ local ID

**The Fix:**
```typescript
const saved = await addCustomFood({
  householdId: household.householdId,
  createdByMemberId: currentUserId || member.id,  // Use auth.uid()
  // ...
});
```

**Important Distinction:**
- `createdByMemberId` (now auth.uid()) = Who can modify this food
- `memberId` (when logging food) = Whose nutrition is being tracked
- These are separate concepts and must remain separate

### Phase 4: Verify RLS Policies

**Current RLS Setup (Migration 005):**

The database has RLS policies checking `member_id = auth.uid()::text`:

```sql
-- households_select_owned
SELECT households WHERE id IN (
  SELECT household_id FROM household_memberships 
  WHERE member_id = auth.uid()::text
)

-- day_logs_select_own_household
SELECT day_logs WHERE household_id IN (
  SELECT household_id FROM household_memberships
  WHERE member_id = auth.uid()::text
)

-- foods_select_household
SELECT foods WHERE household_id IN (
  SELECT household_id FROM household_memberships
  WHERE member_id = auth.uid()::text
)

-- foods_insert_household
INSERT foods WITH CHECK (
  household_id IN (
    SELECT household_id FROM household_memberships
    WHERE member_id = auth.uid()::text
  )
)
```

**Why These Now Work:**
- Before: `auth.uid()` was NULL
- After: `auth.uid()` = user's Supabase UUID
- household_memberships has matching row
- RLS checks pass

## Testing Plan

### 1. New User Signup

**Test:**
```
1. Open app (fresh session/incognito)
2. See AuthLoading spinner
3. See Auth component with "Log in" / "Sign up" tabs
4. Email: test1@example.com
5. Password: TestPassword123!
6. Click "Create account"
```

**Expected:**
- Success message appears
- Redirects to Login tab automatically
- Can then log in with that account

**After Login:**
- Auth initializes
- No households found
- Onboarding appears (Create or Join household)
- No ClaimHouseholdModal (no unclaimed households)

### 2. Existing Household Claim (CRITICAL)

**Test:**
```
1. Open app with existing households in DB
2. New user signs up
3. Auth initializes
4. initAuth finds unclaimedHouseholds
```

**Expected:**
- ClaimHouseholdModal shows existing household
- Shows household name "The Cuties"
- Shows 2 members: "Sindhu", "Bob"
- User clicks "Claim Household"

**After Claiming:**
- household_memberships has new row:
  - household_id = existing ID
  - member_id = auth.uid()
- User loads into main app
- Day logs from existing household appear
- Nutrition profiles available

**DB State:**
```
household_memberships BEFORE:
- household_id: 8c4d72ce..., member_id: 56a87677..., device_token: a01acc...

household_memberships AFTER:
- household_id: 8c4d72ce..., member_id: 56a87677... (unchanged)
- household_id: 8c4d72ce..., member_id: <NEW auth.uid()> (ADDED)
```

### 3. Session Restoration

**Test:**
```
1. User logs in
2. Browser refresh
3. User stays logged in
```

**Expected:**
- On refresh, AuthLoading shows briefly
- `onAuthStateChange` fires
- User remains logged in
- No need to re-enter credentials

### 4. Logout

**Test:**
```
1. Logged-in user
2. Open settings
3. Click "Sign out"
4. Confirm
```

**Expected:**
- Supabase session cleared
- `onAuthStateChange` fires with null session
- Redirect to Auth component
- App resets to initial state

### 5. Custom Food Save (CRITICAL)

**Test:**
```
1. Logged-in user with household
2. Start logging food → Create → Enter custom food
3. Name: "Test Food"
4. Category: "Basic Foods"
5. Calories: 200
6. Save Mode: "Save as Household Food"
7. Click "Add"
```

**Expected:**
- Food saves successfully (no RLS error)
- Food appears in logged meal
- Food stored in foods table with:
  - created_by_member_id = auth.uid() (✅ not member-1)
  - household_id = logged household
  - is_active = true

**Previously Failed:**
- Auth.uid() was NULL
- RLS policy: `created_by_member_id = auth.uid()` = `member-1 = NULL` ❌
- Insert blocked

**Now Works:**
- Auth.uid() = actual user UUID
- RLS policy: `created_by_member_id = auth.uid()` = `<uuid> = <uuid>` ✅
- Insert succeeds

### 6. Nutrition Profile Selection

**Test:**
```
1. Save custom food with "Log for Both" selected
2. Food appears in logs for both members
3. Both members' nutrition totals updated
```

**Expected:**
- createdByMemberId (food creator) = auth.uid()
- memberId (nutrition tracking) = either member can be Sindhu or Bob
- Day logs correctly attribute calories
- "Who ate this" selection is independent of who created it

### 7. Cross-Household Access (Security)

**Test:**
```
1. User A logs in, claims Household A
2. Directly try to access Household B by ID
3. Try to insert food into Household B
```

**Expected:**
- User cannot access Household B
- RLS blocks SELECT (household_id not in memberships)
- RLS blocks INSERT (household_id not in memberships)
- Error message or empty data

**Why This Works:**
```sql
-- RLS checks household_id against user's memberships
WHERE household_id IN (
  SELECT household_id FROM household_memberships
  WHERE member_id = auth.uid()::text  ← Only Household A
)
```

### 8. Join with Code (Already Working)

**Test:**
```
1. User A in Household A
2. Generate join code
3. User B signs up
4. User B "Join household"
5. Enters join code
```

**Expected:**
- RPC `join_household_secure` verifies code
- Creates household_memberships row with:
  - household_id
  - member_id = auth.uid()
- User B now has RLS access

## SQL Migrations (If Needed)

**Current Schema Assumption:**
```sql
household_memberships (
  household_id UUID,
  member_id TEXT,  -- Stores auth.uid()::text
  device_token TEXT,
  joined_at TIMESTAMP
)
```

**If member_id is still storing local IDs:**
- Need migration to separate concerns
- Create `user_id` column for auth.uid()
- Keep `member_id` for local member references
- Update RLS policies

**Migration SQL:**
```sql
-- Add user_id column if not present
ALTER TABLE household_memberships 
ADD COLUMN user_id UUID DEFAULT NULL,
ADD CONSTRAINT fk_auth_user FOREIGN KEY (user_id) 
  REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update RLS to check user_id instead of member_id
DROP POLICY IF EXISTS "households_select_owned" ON households;
CREATE POLICY "households_select_owned" ON households FOR SELECT
USING (
  id IN (
    SELECT household_id FROM household_memberships
    WHERE user_id = auth.uid()
  )
);

-- etc for other policies...
```

**Current Status:**
- ✅ RLS policies already check `member_id = auth.uid()::text`
- ✅ Store implementation uses `member_id` for this
- ✅ No migration needed if consistent

## Security Validation Checklist

- [ ] No anonymous access (RLS blocks unauthenticated)
- [ ] Authenticated users can only access their households
- [ ] Custom food creator must be authenticated
- [ ] Day logs scoped to authenticated user's households
- [ ] No bypassing via household_id parameter (RLS enforces)
- [ ] Logout clears session properly
- [ ] Session token not accessible via localStorage for XSS

## Files Changed Summary

**Code Changes:**
1. `lib/store.ts` - Auth state management
2. `lib/supabase.ts` - Household claim functions
3. `app/page.tsx` - NEW auth entry point
4. `app/main.tsx` - MOVED from app/page.tsx
5. `components/Auth.tsx` - Updated for new flow
6. `components/AuthLoading.tsx` - NEW loading screen
7. `components/ClaimHouseholdModal.tsx` - NEW claim UI
8. `components/AddFoodSheet.tsx` - Use auth.uid() for food creator

**Commits:**
1. `Pre-authentication implementation backup` - Saved current state
2. `Phase 1: Wire authentication into app startup` - Auth gating
3. `Phase 2: Household claim & migration flow` - Claim existing households
4. `Phase 3: Fix custom food ownership to use auth.uid()` - Foods use auth user

## Manual Actions Required

### Before First Deployment

1. **Review RLS Policies**
   - Run: `SELECT * FROM pg_policies WHERE schemaname = 'public'`
   - Verify all policies check `auth.uid()`
   - No `WITH CHECK (true)` policies remain

2. **Test with New User**
   - Sign up in dev/staging
   - Verify session persists
   - Verify claiming existing household works
   - Verify custom food save succeeds

3. **Verify Existing Data**
   - Existing households still accessible
   - Existing day logs visible
   - No data corruption

4. **Backup Production DB**
   - Before rolling out to production
   - Test claim flow in staging first

### After First Authenticated User

1. **Verify household_memberships**
   ```sql
   SELECT * FROM household_memberships 
   WHERE household_id = '<existing-household-id>';
   ```
   Should have:
   - Original row with local member_id
   - New row with auth.uid()

2. **Verify RLS Works**
   ```sql
   SELECT * FROM households WHERE id = '<household-id>';
   -- From authenticated user: should return household
   -- From unauthenticated: should return nothing
   ```

3. **Monitor Errors**
   - Check browser console for auth errors
   - Check server logs for RLS violations
   - Monitor custom food saves

## Remaining Considerations

### Not Yet Implemented

1. **Email verification** - Signup doesn't require email confirmation
2. **Password reset** - Flow exists but not tested
3. **Multi-device sync** - Session is per-device
4. **User profiles** - No way to edit user email/password yet
5. **Invitation links** - Could create shareable household links

### Edge Cases

1. **Existing device tokens** - Old household_memberships rows still have device_token
   - Safe to leave as-is (not used anymore)
   - Can clean up in future migration

2. **Multiple households** - User can join multiple households
   - Works via existing `knownHouseholds` state
   - switchHousehold() handles switching

3. **Account deletion** - Not implemented
   - Would need cascade delete of memberships, foods, logs
   - Plan for future

## Rollback Plan

If deployment issues occur:

1. **Keep pre-auth branch:** `git log --oneline` shows pre-auth commits
2. **Revert commits:** `git revert HEAD~3...HEAD`
3. **Redeploy:** Push reverted code
4. **Database:** RLS policies still in place (safe)

## Questions to Verify

- [ ] Is `household_memberships.member_id` intended to store auth.uid()?
- [ ] Should local member IDs be renamed to avoid confusion?
- [ ] Is email verification required for signup?
- [ ] Should password reset be tested before launch?
- [ ] Any rate limiting on auth attempts?
- [ ] Backup/restore procedures for user data?
