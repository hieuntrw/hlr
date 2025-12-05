-- Migration: add cached aggregate columns to challenge_participants
-- Purpose: avoid expensive full aggregation on every page load by maintaining cached aggregates

ALTER TABLE IF EXISTS public.challenge_participants
ADD COLUMN IF NOT EXISTS actual_km numeric(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS avg_pace_seconds integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS total_activities integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS completion_rate numeric(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS completed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS last_synced_at timestamptz DEFAULT now();

-- Indexes to support leaderboard and participant queries
CREATE INDEX IF NOT EXISTS idx_challenge_participants_challenge_actual_km ON public.challenge_participants (challenge_id, actual_km DESC);
CREATE INDEX IF NOT EXISTS idx_challenge_participants_member ON public.challenge_participants (user_id);

-- NOTE:
-- This migration only adds columns + indexes. You should backfill these values from your
-- current activities/strava data and choose how to keep them up-to-date.
-- See supabase/README_challenge_aggregates.md for suggested backfill and update strategies.
