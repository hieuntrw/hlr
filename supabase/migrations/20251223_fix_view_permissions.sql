-- Migration: Grant SELECT on view_my_finance_status to common roles
-- Date: 2025-12-23

GRANT SELECT ON public.view_my_finance_status TO authenticated;
GRANT SELECT ON public.view_my_finance_status TO anon;
GRANT SELECT ON public.view_my_finance_status TO service_role;

-- Also ensure transactions underlying the view are readable by service_role
GRANT SELECT ON public.transactions TO service_role;
GRANT SELECT ON public.financial_categories TO service_role;
