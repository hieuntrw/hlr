-- Migration: Add avatar_url to profiles
-- Date: 2025-12-06

BEGIN;

-- Add a nullable text column to store avatar URL (can be public URL or storage path)
ALTER TABLE IF EXISTS profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

COMMENT ON COLUMN profiles.avatar_url IS 'URL to user avatar image (public/storage). Nullable.';

COMMIT;
