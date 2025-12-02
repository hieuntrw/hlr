-- Add strava_athlete_name column to profiles table
-- This stores the name from Strava separately from the member's registered name

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS strava_athlete_name TEXT;

COMMENT ON COLUMN profiles.strava_athlete_name IS 'Name from Strava athlete profile (firstname + lastname)';
