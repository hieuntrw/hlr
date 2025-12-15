-- Migration: Migrate role values from raw_user_meta_data -> raw_app_meta_data
-- Created: 2025-12-07
-- Notes:
--  * This migration performs a backup of affected rows and then iterates
--    over all `auth.users` rows that have `raw_user_meta_data`.
--  * It handles JSON-like values containing a "role" key, plain strings
--    (e.g. 'admin' or '"admin"'), and mixed/invalid JSON safely.
--  * The DO-block is defensive: it logs NOTICE and skips rows that fail
--    rather than aborting the whole migration.

CREATE TABLE IF NOT EXISTS admin__auth_users_raw_meta_backup AS
SELECT now() AS backed_at, id, raw_user_meta_data, raw_app_meta_data
FROM auth.users
WHERE raw_user_meta_data IS NOT NULL;

-- Optional preview queries (uncomment to run manually):
-- SELECT id, raw_user_meta_data::text AS raw_text FROM auth.users WHERE raw_user_meta_data IS NOT NULL AND raw_user_meta_data::text NOT LIKE '{%';
-- SELECT id, raw_user_meta_data::text AS raw_text FROM auth.users WHERE raw_user_meta_data IS NOT NULL AND raw_user_meta_data::text LIKE '{%' AND raw_user_meta_data::text ~ '"role"';

DO $$
DECLARE
  r RECORD;
  raw_text TEXT;
  role_found TEXT;
BEGIN
  FOR r IN
    SELECT id, raw_user_meta_data::text AS raw_text
    FROM auth.users
    WHERE raw_user_meta_data IS NOT NULL
  LOOP
    raw_text := r.raw_text;
    role_found := NULL;

    -- Case 1: JSON-like and contains "role"
    IF raw_text LIKE '{%' AND raw_text ~ '"role"' THEN
      role_found := substring(raw_text FROM '"role"\s*:\s*"([^"]+)"');

    -- Case 2: not JSON-like but may still contain "role":"value"
    ELSIF raw_text ~ '"role"' THEN
      role_found := substring(raw_text FROM '"role"\s*:\s*"([^"]+)"');

    -- Case 3: plain string like: admin  OR  "admin"  OR  'admin'
    ELSE
      -- Remove surrounding quotes/spaces/backticks and keep safe chars
      role_found := regexp_replace(raw_text, '^[\s"''`]+|[\s"''`]+$', '', 'g');
      role_found := regexp_replace(role_found, '[^A-Za-z0-9_+-]+', '', 'g');
    END IF;

    IF role_found IS NULL OR trim(role_found) = '' THEN
      CONTINUE;
    END IF;

    BEGIN
      -- Upsert role into raw_app_meta_data as jsonb
      UPDATE auth.users
      SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) ||
          jsonb_build_object('role', role_found)
      WHERE id = r.id;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed to set raw_app_meta_data for id %: %', r.id, SQLERRM;
      CONTINUE;
    END;

    -- Try to remove role from raw_user_meta_data if it's JSON-like and castable,
    -- otherwise NULL the column for plain-string cases (we backed up earlier).
    BEGIN
      IF raw_text LIKE '{%' THEN
        UPDATE auth.users
        SET raw_user_meta_data = (raw_user_meta_data::jsonb - 'role')
        WHERE id = r.id;
      ELSE
        UPDATE auth.users
        SET raw_user_meta_data = NULL
        WHERE id = r.id;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not remove role from raw_user_meta_data for id %: %', r.id, SQLERRM;
    END;
  END LOOP;
END;
$$;

-- Verification queries:
-- SELECT count(*) FROM auth.users WHERE raw_app_meta_data IS NOT NULL AND raw_app_meta_data::text ~ '"role"';
-- SELECT id, raw_user_meta_data::text, raw_app_meta_data FROM auth.users WHERE raw_app_meta_data IS NOT NULL ORDER BY id LIMIT 50;
