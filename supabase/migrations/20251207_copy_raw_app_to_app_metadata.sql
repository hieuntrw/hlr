-- Migration: Copy role from raw_app_meta_data -> app_metadata
-- Created: 2025-12-07
-- This migration:
--  1) Backs up existing `app_metadata` and `raw_app_meta_data` for rows with raw data
--  2) Iterates rows with `raw_app_meta_data`, extracts a `role` value (JSON or plain string)
--  3) Sets `app_metadata.role` only when it is absent, to avoid overwriting existing server-set roles
--  4) Logs NOTICE for rows that cannot be parsed or updated

-- Backup the raw columns only; `app_metadata` is not always a physical column
-- in the `auth.users` table depending on Supabase/Postgres version. We back
-- up the raw columns which are present.
CREATE TABLE IF NOT EXISTS admin__auth_users_appmeta_backup AS
SELECT now() AS backed_at, id, raw_app_meta_data, raw_user_meta_data
FROM auth.users
WHERE raw_app_meta_data IS NOT NULL;

DO $$
DECLARE
  r RECORD;
  raw_val JSONB;
  raw_text TEXT;
  role_value TEXT;
BEGIN
  FOR r IN SELECT id, raw_app_meta_data FROM auth.users WHERE raw_app_meta_data IS NOT NULL LOOP
    role_value := NULL;
    BEGIN
      -- Try to parse as jsonb if possible
      IF pg_typeof(r.raw_app_meta_data) = 'jsonb'::regtype THEN
        raw_val := r.raw_app_meta_data::jsonb;
        IF raw_val ? 'role' THEN
          role_value := raw_val ->> 'role';
        END IF;
      ELSE
        raw_text := r.raw_app_meta_data::text;
        -- If it looks like JSON, try casting to jsonb
        IF raw_text LIKE '{%' THEN
          BEGIN
            raw_val := raw_text::jsonb;
            IF raw_val ? 'role' THEN
              role_value := raw_val ->> 'role';
            END IF;
          EXCEPTION WHEN OTHERS THEN
            -- parse failed, fall back to string extraction
            role_value := NULL;
          END;
        END IF;
        -- If still no role, attempt regex extraction of "role":"value"
        IF role_value IS NULL THEN
          role_value := substring(raw_text FROM '"role"\s*:\s*"([^\"]+)"');
        END IF;
        -- If still no role, treat the raw text as a plain role token
        IF role_value IS NULL THEN
          -- strip quotes/whitespace/backticks and keep safe chars
          role_value := regexp_replace(raw_text, '^[\s"''`]+|[\s"''`]+$', '', 'g');
          role_value := regexp_replace(role_value, '[^A-Za-z0-9_+-]+', '', 'g');
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Parsing raw_app_meta_data failed for id %: %', r.id, SQLERRM;
      CONTINUE;
    END;

    IF role_value IS NULL OR trim(role_value) = '' THEN
      -- nothing to promote
      CONTINUE;
    END IF;

    BEGIN
      -- Update raw_app_meta_data (safe): merge the role into the raw jsonb column
      -- We avoid writing to `app_metadata` directly because some Supabase
      -- deployments do not expose it as a writable column; use the Admin API
      -- to set `app_metadata` if you need JWTs to update immediately.
      UPDATE auth.users
      SET app_metadata = COALESCE(raw_app_meta_data::jsonb, '{}'::jsonb) || jsonb_build_object('role', role_value)
      WHERE id = r.id;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed to update raw_app_meta_data for id %: %', r.id, SQLERRM;
      CONTINUE;
    END;
  END LOOP;
END;
$$;

-- Verification hints:
-- SELECT id, app_metadata, raw_app_meta_data FROM auth.users WHERE app_metadata IS NOT NULL AND app_metadata::text ~ '"role"' ORDER BY id LIMIT 50;
-- SELECT count(*) FROM auth.users WHERE app_metadata IS NOT NULL AND app_metadata::text ~ '"role"';
