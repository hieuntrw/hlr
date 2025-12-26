// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { getSupabaseServiceClient } from './supabase-service-client';

// ============================================================================
// DEPRECATED: All functions below are not used anywhere in the codebase.
// They were intended for finance transaction queries but financeService.ts
// now handles these operations via views and RPCs.
// Marked for potential deletion - Dec 2024
// ============================================================================

/* UNUSED - getIncomePaid
export const getIncomePaid = async (year: number) => {
  const svc = getSupabaseServiceClient();
  const { data, error } = await svc
    .from('view_transactions_master')
    .select('*')
    .eq('fiscal_year', year)
    .eq('flow_type', 'in')
    .eq('payment_status', 'paid')
    .order('processed_at', { ascending: false });

  if (error) {
    console.error('[getIncomePaid] error', error);
    return null;
  }
  return data;
};
*/

/* UNUSED - getExpensePaid
export const getExpensePaid = async (year: number) => {
  const svc = getSupabaseServiceClient();
  const { data, error } = await svc
    .from('view_transactions_master')
    .select('*')
    .eq('fiscal_year', year)
    .eq('flow_type', 'out')
    .eq('payment_status', 'paid')
    .order('processed_at', { ascending: false });

  if (error) {
    console.error('[getExpensePaid] error', error);
    return null;
  }
  return data;
};
*/

/* UNUSED - getPendingTransactions
export const getPendingTransactions = async (year: number) => {
  const svc = getSupabaseServiceClient();
  const { data, error } = await svc
    .from('view_transactions_master')
    .select('*')
    .eq('fiscal_year', year)
    .eq('payment_status', 'pending')
    .order('processed_at', { ascending: false });

  if (error) {
    console.error('[getPendingTransactions] error', error);
    return null;
  }
  return data;
};
*/

/* UNUSED - getProblematicTransactions
export const getProblematicTransactions = async (year: number) => {
  const svc = getSupabaseServiceClient();
  const { data, error } = await svc
    .from('view_transactions_master')
    .select('*')
    .eq('fiscal_year', year)
    .in('payment_status', ['pending', 'cancelled'])
    .order('processed_at', { ascending: false });

  if (error) {
    console.error('[getProblematicTransactions] error', error);
    return null;
  }
  return data;
};
*/

// Placeholder export to avoid "empty module" error
export {};
