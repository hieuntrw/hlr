-- Migration: Add rejection_reason to transactions
ALTER TABLE IF EXISTS public.transactions
ADD COLUMN IF NOT EXISTS rejection_reason text;
