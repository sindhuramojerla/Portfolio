-- ============================================================
-- Migration 008: Allow Household Discovery for Authentication
-- ============================================================
--
-- When a user first logs in, they have no household memberships yet.
-- We need to show them available households to claim/join.
-- This policy allows authenticated users to SELECT all households
-- for discovery purposes, while maintaining security for other operations.
--

-- Add a SELECT policy that allows all authenticated users to discover households
CREATE POLICY "households_select_authenticated"
  ON households FOR SELECT
  USING (auth.role() = 'authenticated');

-- The existing "households_select_owned" policy still applies and is more restrictive
-- PostgreSQL allows multiple policies and unions them, so this simply expands discovery
-- while "select_owned" remains for detailed access
