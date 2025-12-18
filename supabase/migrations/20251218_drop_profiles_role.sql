-- Migration: Drop `role` column from profiles (use app_metadata for roles)
-- Date: 2025-12-18

BEGIN;

-- 1) Drop named role constraint if present (older migrations may have added it)
ALTER TABLE IF EXISTS profiles DROP CONSTRAINT IF EXISTS profiles_role_allowed;

-- 2) Remove the role column (if exists)
ALTER TABLE IF EXISTS profiles DROP COLUMN IF EXISTS role;

COMMIT;
