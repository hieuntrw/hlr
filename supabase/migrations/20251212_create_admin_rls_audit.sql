-- Migration: create admin__rls_audit table for recording RLS-denied attempts
CREATE TABLE IF NOT EXISTS admin__rls_audit (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL,
  user_id UUID,
  attempted_by TEXT,
  error_code TEXT,
  message TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_rls_audit_table ON admin__rls_audit(table_name);
