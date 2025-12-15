-- Migration: assign newly inserted/updated activities to existing challenge participants
-- When an activity is inserted (or updated) and has no challenge_participant_id,
-- this trigger will find an eligible participant (same user, challenge window, pace/distance/map requirements)
-- and set the activity.challenge_participant_id accordingly, then call the
-- recalc RPC to update cached aggregates for that participant.

CREATE OR REPLACE FUNCTION public.hlr_assign_activity_to_participant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cp RECORD;
  v_pace_seconds NUMERIC;
BEGIN
  -- If already assigned, nothing to do
  IF NEW.challenge_participant_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- compute pace if possible (seconds per km)
  IF COALESCE(NEW.distance,0) > 0 AND COALESCE(NEW.moving_time,0) > 0 THEN
    v_pace_seconds := (NEW.moving_time::numeric) / (NEW.distance::numeric / 1000.0);
  ELSE
    v_pace_seconds := NULL;
  END IF;

  -- Find one eligible participant (most-recent challenge window first)
  SELECT cp.id, cp.challenge_id
  INTO v_cp
  FROM public.challenge_participants cp
  JOIN public.challenges c ON c.id = cp.challenge_id
  WHERE cp.user_id = NEW.user_id
    -- Strava activities are stored in UTC; challenge start/end are in UTC+7.
    -- Convert activity time to UTC+7 by adding 7 hours before comparing to challenge window.
    AND ((NEW.start_date::timestamp AT TIME ZONE 'UTC') + INTERVAL '7 hours') >= (c.start_date::timestamp)
    AND ((NEW.start_date::timestamp AT TIME ZONE 'UTC') + INTERVAL '7 hours') <= ((c.end_date::timestamp + INTERVAL '1 day' - INTERVAL '1 second'))
    -- require map if challenge requires it
    AND (COALESCE(c.require_map, false) = false OR (COALESCE(NEW.map_summary_polyline,'') <> ''))
    -- require minimum distance when set
    AND (COALESCE(c.min_km, 0) = 0 OR COALESCE(NEW.distance,0) >= COALESCE(c.min_km,0) * 1000)
    -- pace constraints (only enforce when pace is calculable)
    AND (
      v_pace_seconds IS NULL
      OR (v_pace_seconds BETWEEN COALESCE(c.min_pace_seconds, 240) AND COALESCE(c.max_pace_seconds, 720))
    )
  ORDER BY c.start_date DESC
  LIMIT 1;

  IF FOUND AND v_cp.id IS NOT NULL THEN
    -- assign activity to participant
    UPDATE public.activities
    SET challenge_participant_id = v_cp.id
    WHERE id = NEW.id;

    -- Recalculate aggregates for that participant (use existing SECURITY DEFINER RPC)
    PERFORM public.recalc_challenge_participant_aggregates(v_cp.challenge_id, v_cp.id);
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger: run after insert or relevant updates on activities
DROP TRIGGER IF EXISTS hlr_assign_activity_to_participant_trigger ON public.activities;
CREATE TRIGGER hlr_assign_activity_to_participant_trigger
AFTER INSERT OR UPDATE OF user_id, start_date, distance, moving_time, map_summary_polyline, challenge_participant_id ON public.activities
FOR EACH ROW
WHEN (NEW.challenge_participant_id IS NULL)
EXECUTE FUNCTION public.hlr_assign_activity_to_participant();
