-- Migration: add receipt and audit columns to transactions

ALTER TABLE IF EXISTS public.transactions
ADD COLUMN IF NOT EXISTS receipt_url text,
ADD COLUMN IF NOT EXISTS receipt_uploaded_by uuid,
ADD COLUMN IF NOT EXISTS receipt_uploaded_at timestamptz,
ADD COLUMN IF NOT EXISTS paid_by uuid,
ADD COLUMN IF NOT EXISTS paid_at timestamptz,
ADD COLUMN IF NOT EXISTS rejected_by uuid,
ADD COLUMN IF NOT EXISTS rejected_at timestamptz;

-- Optional indexes to help queries by status and uploader
CREATE INDEX IF NOT EXISTS idx_transactions_payment_status ON public.transactions (payment_status);
CREATE INDEX IF NOT EXISTS idx_transactions_receipt_uploaded_by ON public.transactions (receipt_uploaded_by);

-- RLS note: ensure policies allow admins to update payment_status/paid_by fields.
-- Example policy (apply separately via SQL or Supabase dashboard):
-- CREATE POLICY admin_update_transactions ON public.transactions
-- FOR UPDATE USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')) WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
