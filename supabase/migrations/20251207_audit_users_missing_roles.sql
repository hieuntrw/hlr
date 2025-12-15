-- Migration: Audit users missing role information
-- Created: 2025-12-07
-- This migration creates an audit table `admin__auth_users_appmeta_skipped` and
-- populates it with users where no role could be found in raw_app_meta_data,
-- raw_user_meta_data, or user_metadata. Use this for manual review and assignment.

CREATE TABLE IF NOT EXISTS admin__auth_users_appmeta_skipped (
  backfilled_at timestamptz DEFAULT now(),
  id uuid PRIMARY KEY,
  email text,
  raw_user_meta_data text,
  raw_app_meta_data text,
  -- user_metadata removed: we rely on raw_user_meta_data / raw_app_meta_data only
  note text
);

-- Populate with users that appear to have no role in any common field.
INSERT INTO admin__auth_users_appmeta_skipped (id, email, raw_user_meta_data, raw_app_meta_data, note)
SELECT
  u.id,
  u.email,
  u.raw_user_meta_data::text,
  u.raw_app_meta_data::text,
  'no role found in raw_user_meta_data or raw_app_meta_data'
FROM auth.users u
WHERE (
  u.raw_app_meta_data IS NULL OR u.raw_app_meta_data::text NOT LIKE '%"role"%'
) AND (
  u.raw_user_meta_data IS NULL OR u.raw_user_meta_data::text NOT LIKE '%"role"%'
)
ON CONFLICT (id) DO NOTHING;

-- Quick check query (run after migration):
-- SELECT count(*) FROM admin__auth_users_appmeta_skipped;
-- SELECT * FROM admin__auth_users_appmeta_skipped ORDER BY backfilled_at DESC LIMIT 200;
