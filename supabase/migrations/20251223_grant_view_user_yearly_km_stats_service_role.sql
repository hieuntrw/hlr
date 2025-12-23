-- Migration: Grant service_role SELECT on view_user_yearly_km_stats
-- Run this after deploying views so service-role can query them directly

GRANT SELECT ON public.view_user_yearly_km_stats TO service_role;
