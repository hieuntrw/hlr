-- Migration: Add PL/pgSQL RPC to recalc and update cached aggregates for challenge participants
-- This function updates `challenge_participants` cached columns from `activities`.
-- Usage via Supabase RPC: POST /rpc/recalc_challenge_participant_aggregates with JSON { p_challenge_id, p_participant_id }

CREATE OR REPLACE FUNCTION public.recalc_challenge_participant_aggregates(
  p_challenge_id uuid,
  p_participant_id uuid DEFAULT NULL
) RETURNS TABLE(
  participant_id uuid,
  actual_km numeric(10,2),
  total_activities integer,
  avg_pace_seconds integer,
  completion_rate numeric(5,2),
  completed boolean
) AS $$
DECLARE
  r RECORD;
  total_meters numeric;
  total_seconds bigint;
  act_count integer;
  t_km numeric(10,2);
  avg_pace integer;
  comp_rate numeric(5,2);
  is_completed boolean;
BEGIN
  FOR r IN
    SELECT id, target_km
    FROM public.challenge_participants
    WHERE challenge_id = p_challenge_id
      AND (p_participant_id IS NULL OR id = p_participant_id)
  LOOP
    SELECT COALESCE(SUM(distance), 0), COALESCE(SUM(moving_time), 0), COALESCE(COUNT(*), 0)
      INTO total_meters, total_seconds, act_count
      FROM public.activities
      WHERE challenge_participant_id = r.id;

    -- actual_km rounded to 2 decimals
    t_km := ROUND((total_meters / 1000.0)::numeric * 100) / 100;

    IF t_km > 0 THEN
      avg_pace := ROUND(total_seconds / t_km);
    ELSE
      avg_pace := NULL;
    END IF;

    IF r.target_km IS NULL OR r.target_km = 0 THEN
      comp_rate := 0;
    ELSE
      comp_rate := ROUND((t_km / r.target_km) * 10000)::numeric / 100;
    END IF;

    is_completed := (r.target_km IS NOT NULL AND t_km >= r.target_km);

    -- Update participant cached columns (canonical names)
    -- Note: do NOT persist `completion_rate` column here. Compute it and return it
    -- from the RPC result but avoid writing it to the DB to keep schema flexible.
    UPDATE public.challenge_participants
    SET actual_km = t_km,
      avg_pace_seconds = avg_pace,
      total_activities = act_count,
      last_synced_at = now(),

      -- cached aggregates (do NOT persist completion_rate here)
      completed = is_completed,

      -- don't overwrite status to non-completed values, but set to 'completed' if achieved
      status = CASE WHEN is_completed THEN 'completed' ELSE status END
    WHERE id = r.id;

    participant_id := r.id;
    actual_km := t_km;
    total_activities := act_count;
    avg_pace_seconds := avg_pace;
    completion_rate := comp_rate;
    completed := is_completed;
    RETURN NEXT;
  END LOOP;

  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.recalc_challenge_participant_aggregates(uuid, uuid) IS
  'Recalculate and update cached aggregates on challenge_participants from activities. SECURITY DEFINER.';
