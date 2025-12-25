import { getSupabaseServiceClient } from './supabase-service-client';

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
