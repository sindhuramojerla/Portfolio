# Authentication Testing Checklist

## Pre-Deployment Verification

### Database State Check

**Run These Queries:**

```sql
-- Check auth users
SELECT COUNT(*) as auth_user_count FROM auth.users;

-- Check households
SELECT id, config->>'householdName' as name, created_at 
FROM households;

-- Check household_memberships
SELECT household_id, member_id, device_token, joined_at
FROM household_memberships;

-- Check for NULL auth.uid() issues
SELECT COUNT(*) as foods_with_null_creator
FROM foods WHERE created_by_member_id IS NULL;

-- Verify RLS policies exist
SELECT policyname, qual, with_check FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'households';
```

**Expected Results:**
- 0 auth users (before first signup)
- 2 households (The Cuties, sdfghjk)
- 2 membership rows with local member IDs
- 0 custom foods (food_type = 'household')
- No NULL creators

### Code Review Checklist

- [ ] `app/page.tsx` - Auth gating in place
- [ ] `app/main.tsx` - Main app moved from page.tsx
- [ ] `lib/store.ts` - authInitialized, authLoading states added
- [ ] `components/Auth.tsx` - Works without onAuthSuccess callback
- [ ] `components/AuthLoading.tsx` - Shows spinner during session check
- [ ] `components/ClaimHouseholdModal.tsx` - Shows unclaimed households
- [ ] `components/AddFoodSheet.tsx` - Uses currentUserId for food creator
- [ ] `lib/supabase.ts` - claimHousehold() and fetchAllHouseholds() added

### Local Dev Testing

**Test 1: New User Signup**
```
1. Open http://localhost:3000
2. See AuthLoading (brief spinner)
3. See Auth component
4. Click "Sign up"
5. Enter:
   - Email: test@example.com
   - Password: Test123!
6. Click "Create account"
```
**Verify:**
- Success message appears
- Form clears
- Switched to "Log in" tab automatically
- Can now log in with those credentials

**Test 2: Household Claim (CRITICAL)**
```
1. Open app (still in signup mode)
2. Click "Log in"
3. Enter test@example.com, Test123!
4. Click "Log in"
```
**Verify:**
- Loading screen briefly
- If databases have existing households:
  - ClaimHouseholdModal appears
  - Shows "The Cuties" or "sdfghjk"
  - Shows member names
  - User can click "Claim Household"
- After claiming:
  - Modal closes
  - Main app shows
  - Onboarding complete
  - Can see household members and logs

**Test 3: Custom Food Save**
```
1. Logged in, household loaded
2. Click any meal area
3. Click "Create New Food"
4. Enter:
   - Name: "Test Biryani"
   - Type: "Homemade"
   - Serving: "1 bowl"
   - Calories: 500
   - Protein: 20g
   - Save Mode: "Save as Household Food"
5. Click "Add"
```
**Verify:**
- Food saves without error (this previously failed)
- Food appears in meal log
- Can select who ate it (Sindhu or Bob)
- Both members' nutrition updates

**Test 4: Refresh Persistence**
```
1. Logged in with household loaded
2. Press F5 or Cmd+R to refresh
```
**Verify:**
- Brief AuthLoading spinner
- User still logged in (no redirect to Auth)
- Household still loaded
- Session persists

**Test 5: Logout**
```
1. Click settings/menu
2. Look for "Sign out" button
3. Click it
```
**Verify:**
- Session cleared
- Redirect to Auth component
- Can log in again with same account

**Test 6: Different Browser Tab**
```
1. Open app in Tab A (logged in)
2. Open app in Tab B (new tab, logged in automatically)
3. In Tab A: logout
```
**Verify:**
- Tab B: Also logs out (or resets on next action)
- Session is per-browser, not per-tab

### RLS Policy Testing

**Test: Unauthenticated Access Blocked**
```
-- Via Supabase client without auth:
const { data } = await supabase
  .from('households')
  .select('*')
  .eq('id', '<household-id>')

// Result: Should return empty (no rows)
```

**Test: Cross-Household Access Blocked**
```
1. User A claims Household A
2. User B claims Household B
3. User A tries to access Household B's data:
   - Via API: GET /api/households/<B-id>
   - Should fail RLS check
```

**Test: Custom Food Creator Check**
```
1. User A saves custom food in Household A
2. Query: foods table
3. Verify: created_by_member_id = User A's auth.uid() (not local member-1)
4. User B tries to update User A's food
5. Should fail UPDATE RLS check
```

## Staging Environment Testing

### Setup
1. Deploy to staging environment
2. Point to staging Supabase project
3. Ensure prod database not accessible

### Sign-Up Flow
```
1. New user signs up with staging email
2. Verify email in Supabase auth console
3. User claims existing household
4. Can create and save custom foods
5. Foods persist after refresh
6. Can log in from different browser
7. Can log out and log back in
```

### Existing Household Preservation
```
1. Check staging DB for existing households
2. First new user claims household
3. Verify:
   - Household name unchanged
   - Members unchanged
   - Day logs still present
   - No data corruption
4. Second user joins with code
5. Both users see same household
6. Both can save custom foods
```

### Cross-User Data Isolation
```
1. User A (Household A): Saves "Biryani"
2. User B (Household B): Cannot see "Biryani"
3. User A: Updates "Biryani" nutrition
4. User B: No effect on their meals
5. User A's "Biryani" shows correct nutrition in logs
```

## Production Rollout Checklist

**Before Deploying:**
- [ ] All local tests passing
- [ ] Staging tests passing
- [ ] Code review completed
- [ ] Database backup created
- [ ] Rollback plan documented
- [ ] Team notified of changes

**During Deployment:**
- [ ] Deploy code changes
- [ ] Monitor error logs
- [ ] Monitor auth failures
- [ ] Check custom food saves (key failing feature)
- [ ] Verify session creation working

**After Deployment:**
- [ ] First user signs up successfully
- [ ] First user claims household without errors
- [ ] Custom food save succeeds (no RLS errors)
- [ ] Multiple users can access same household
- [ ] Users cannot access other households
- [ ] Logout clears session properly
- [ ] Monitor Supabase logs for auth/RLS errors

**First Week Monitoring:**
- [ ] Daily check of signup attempts
- [ ] Monitor for auth error spikes
- [ ] Check for RLS violations in logs
- [ ] Verify custom food saves succeeding
- [ ] No orphaned auth sessions

## Known Issues & Workarounds

### Issue: Auth takes 3-5 seconds to initialize
**Status:** Expected (Supabase session restoration)
**Workaround:** AuthLoading component shows spinner
**Acceptable:** Yes

### Issue: Email verification not enforced
**Status:** By design (for ease of testing)
**Risk:** Low (internal app, will add later)
**Action:** Plan for Phase 2 (email verification)

### Issue: device_token columns still populated
**Status:** Legacy (no longer used)
**Risk:** None (RLS doesn't check them)
**Action:** Can clean up in future migration

## Debugging Guide

### User can't log in
```
1. Check Supabase Auth console for user
2. Verify email/password correct
3. Check browser console for errors
4. Check if session restoration hanging:
   - Open DevTools → Network
   - Check for failed requests
   - Look for auth.supabase.co timeouts
```

### Custom food save fails with RLS error
```
1. Verify user is authenticated:
   - Check store.currentUserId in DevTools
   - Should not be null
2. Verify household_memberships has entry:
   - SELECT * FROM household_memberships 
     WHERE user_id = '<user-uuid>'
3. Verify user can access household:
   - Check RLS policy matches
4. Check created_by_member_id is auth.uid():
   - Should not be member-1, member-2, etc
```

### Household claim doesn't work
```
1. Verify unclaimedHouseholds populated:
   - Check store.unclaimedHouseholds in DevTools
   - Should have household entries
2. Verify claimHousehold RPC works:
   - Check Supabase logs for RPC calls
   - Look for errors in function execution
3. Verify household_memberships insert succeeds:
   - Query DB after claiming
   - Should have new row with user_id = auth.uid()
```

### Session doesn't persist after refresh
```
1. Check browser LocalStorage:
   - Dev Tools → Storage → LocalStorage
   - Look for supabase.auth.* entries
   - Should have session tokens
2. Check auth.supabase.co cookies:
   - Should have session.auth.* cookies
3. Check onAuthStateChange:
   - Add console.log in initAuth()
   - Should fire on page load with session
```

## Performance Testing

### Expected Load Times
- Initial page load: < 2 seconds
- Auth initialization: < 5 seconds
- Household load: < 1 second
- Custom food save: < 2 seconds
- Food search: < 500ms

### Monitor These Metrics
- Auth initialization time
- RLS policy evaluation time
- Custom food insert time
- Household query time

## Accessibility Testing

- [ ] Auth form keyboard navigable
- [ ] Error messages readable
- [ ] Claim household modal accessible
- [ ] Success/error messages announced to screen readers
- [ ] Loading state indicated (spinner or aria-busy)

## Security Testing

- [ ] Cannot access other user's households
- [ ] Cannot modify other user's foods
- [ ] RLS blocks all unauthenticated access
- [ ] Session tokens not accessible via XSS (httpOnly)
- [ ] Logout properly clears tokens
- [ ] No sensitive data in localStorage
