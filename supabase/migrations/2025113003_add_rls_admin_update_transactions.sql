-- Migration: RLS policy for admin-only updates on transactions

-- Enable RLS if not already enabled
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Policy: Only allow admins to update payment_status, paid_by, paid_at, rejected_by, rejected_at, receipt_url, receipt_uploaded_by, receipt_uploaded_at
CREATE POLICY admin_update_transactions ON public.transactions
FOR UPDATE
USING (
  ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
)
WITH CHECK (
  ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
);

-- Optionally, allow mod_finance as well:
-- Add OR profiles.role = 'mod_finance' in the EXISTS clause if needed.
