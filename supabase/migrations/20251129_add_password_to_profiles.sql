-- Migration: Add password field to profiles table
-- Purpose: Enable local member authentication with email/password
-- Date: 2025-11-29

-- Add password column to profiles table (nullable for now; can be set during member signup)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS password TEXT;

-- Optional: Add a comment to document this field
COMMENT ON COLUMN profiles.password IS 'Hashed password for local authentication (optional; members can also use Supabase auth)';

-- Optional: Add a unique constraint on email if not already present (for auth purposes)
-- Note: This may already exist from auth.users, but profiles.email might be separate
-- ALTER TABLE profiles ADD CONSTRAINT unique_profiles_email UNIQUE (email);
