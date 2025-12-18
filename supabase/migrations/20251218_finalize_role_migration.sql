-- Migration: Diagnostic helpers to finalize role migration
-- Purpose: scan pg_policies for references to `profiles.role` or `user_metadata`
-- and print suggested replacements that use the JWT `app_metadata` role
-- NOTE: This script does NOT execute destructive changes. It prints
-- suggested DROP/CREATE statements for manual review and execution.

DO $$
DECLARE
  r record;
  new_qual text;
  new_with_check text;
BEGIN
  RAISE NOTICE 'Scanning pg_policies for references to profiles.role or user_metadata...';
  FOR r IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE (qual IS NOT NULL AND (qual ILIKE '%profiles.role%' OR qual ILIKE '%user_metadata%'))
       OR (with_check IS NOT NULL AND (with_check ILIKE '%profiles.role%' OR with_check ILIKE '%user_metadata%'))
  LOOP
    new_qual := NULL;
    new_with_check := NULL;
    IF r.qual IS NOT NULL THEN
      new_qual := regexp_replace(r.qual::text, 'profiles\\.role', '(auth.jwt() -> ''app_metadata'' ->> ''role'')', 'gi');
      new_qual := regexp_replace(new_qual, 'user_metadata', 'app_metadata', 'gi');
    END IF;
    IF r.with_check IS NOT NULL THEN
      new_with_check := regexp_replace(r.with_check::text, 'profiles\\.role', '(auth.jwt() -> ''app_metadata'' ->> ''role'')', 'gi');
      new_with_check := regexp_replace(new_with_check, 'user_metadata', 'app_metadata', 'gi');
    END IF;

    RAISE NOTICE '-------------------------------------------------------------------';
    RAISE NOTICE 'Schema: %  Table: %  Policy: %', r.schemaname, r.tablename, r.policyname;
    RAISE NOTICE 'Old qual: %', coalesce(r.qual::text, '<null>');
    RAISE NOTICE 'Old with_check: %', coalesce(r.with_check::text, '<null>');
    RAISE NOTICE 'Suggested new qual: %', coalesce(new_qual, '<null>');
    RAISE NOTICE 'Suggested new with_check: %', coalesce(new_with_check, '<null>');
    RAISE NOTICE 'Suggested DROP/CREATE (manual review required):';
    RAISE NOTICE '  DROP POLICY IF EXISTS % ON %.% ;', r.policyname, r.schemaname, r.tablename;
    RAISE NOTICE '  -- Example create (adjust FOR clause and roles as appropriate):';
    RAISE NOTICE '  CREATE POLICY % ON %.% FOR ALL USING (%);', r.policyname, r.schemaname, r.tablename, coalesce(new_qual, 'true');
    IF new_with_check IS NOT NULL THEN
      RAISE NOTICE '    WITH CHECK (%);', new_with_check;
    END IF;
  END LOOP;
  RAISE NOTICE 'Scan complete.';
END;
$$ LANGUAGE plpgsql;

-- After reviewing the suggested statements, apply them manually or
-- embed DROP/CREATE commands below (carefully) to update policies.
