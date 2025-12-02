-- Migration: Remove password field from profiles table
-- Purpose: Authentication now exclusively through Supabase Auth (Strava OAuth)
-- Date: 2025-12-02

-- Drop password column from profiles table
ALTER TABLE profiles
DROP COLUMN IF EXISTS password;

-- Remove comment if exists
COMMENT ON COLUMN profiles.password IS NULL;
