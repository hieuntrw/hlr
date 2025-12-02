-- Migration: Add gender column to profiles table
-- Purpose: Enable gender-based milestone rewards and complete member profile
-- Date: 2025-12-02

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS gender VARCHAR(10) CHECK (gender IN ('male', 'female'));

CREATE INDEX IF NOT EXISTS idx_profiles_gender ON profiles(gender) WHERE gender IS NOT NULL;

COMMENT ON COLUMN profiles.gender IS 'Member gender for milestone reward calculation (male/female)';
