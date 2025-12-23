import { supabase } from "@/lib/supabase-client";
import getSupabaseServiceClient from '@/lib/supabase-service-client';
import { TransactionMetadata } from '@/types/finance'

// (Moved getClubBalance & createOpeningBalance into the financeService object below)


export const financeService = {
  // Type guards for supabase responses
  
  
  // (internal helpers)
  
  
 
// Hàm mới: Lấy báo cáo theo danh mục và năm
  async getReportByCategory(year: number) {
    const client = typeof window === 'undefined' ? getSupabaseServiceClient() : supabase;
    const { data, error } = await client
      .from('view_finance_report_by_category')
      .select('*')
      .eq('fiscal_year', year)
      .order('total_amount', { ascending: false }); // Sắp xếp số tiền lớn nhất lên đầu

    if (error) throw error;
    return data;
  },

  // 1. Lấy thống kê công khai 
  async getPublicStats() {
    const client = typeof window === 'undefined' ? getSupabaseServiceClient() : supabase;
    const { data, error } = await client.from('view_public_fund_stats').select('*').maybeSingle();
    if (error) throw error;
    return data;
  },

  // Tổng chi trong năm (RPC -> get_total_expense)
  async getTotalExpense(year: number) {
    const client = typeof window === 'undefined' ? getSupabaseServiceClient() : supabase;
    const { data, error } = await client.rpc('get_total_expense', { year_input: year });
    if (error) throw error;
    const value = data as unknown;
    return typeof value === 'number' ? value : Number(value ?? 0);
  },

  // 2. Lấy danh sách chi tiêu công khai
  async getRecentExpenses() {
    // Try client-side supabase first, with retries in case session is not ready.
    async function tryClient() {
      const { data, error } = await (typeof window === 'undefined' ? getSupabaseServiceClient() : supabase).from('view_public_recent_expenses').select('*');
      return { data, error };
    }

    // Retry helper
    async function retry<T>(fn: () => Promise<T>, attempts = 3, delayMs = 250): Promise<T> {
      let lastErr: unknown;
      for (let i = 0; i < attempts; i++) {
        try {
          // eslint-disable-next-line no-await-in-loop
          return await fn();
        } catch (e) {
          lastErr = e;
          // eslint-disable-next-line no-await-in-loop
          await new Promise(res => setTimeout(res, delayMs * (i + 1)));
        }
      }
      throw lastErr;
    }

    try {
      const res = await retry(() => tryClient());
      if (res && typeof res === 'object') {
        const rec = res as unknown as Record<string, unknown>;
        if (rec.error) throw rec.error;
        if (rec.data) return rec.data;
      }
    } catch (e) {
      // fallthrough to server fallback
      console.warn('[financeService] client recent-expenses retry failed, falling back to server', String(e));
    }

    // Server fallback (use server route which uses service role)
    try {
      const r = await fetch('/api/finance/recent-expenses', { credentials: 'include' });
      if (!r.ok) throw new Error(`server fallback failed ${r.status}`);
      const body = await r.json();
      return body.data ?? [];
    } catch (e) {
      console.error('[financeService] recent-expenses fallback error', String(e));
      throw e;
    }
  },

  // Tổng thu thực tế trong năm (loại bỏ OPENING_BALANCE)
  async getTotalIncomeReal(year: number) {
    const client = typeof window === 'undefined' ? getSupabaseServiceClient() : supabase;
    const { data, error } = await client.rpc('get_total_income_real', { year_input: year });
    if (error) throw error;
    const value = data as unknown;
    return typeof value === 'number' ? value : Number(value ?? 0);
  },

  // 3. Lấy tài chính cá nhân
  async getMyFinance(userId: string, year: number) {
    // Client attempt with retry
    async function tryClient() {
      return (typeof window === 'undefined' ? getSupabaseServiceClient() : supabase)
        .from('view_my_finance_status')
        .select('*')
        .eq('user_id', userId)
        .eq('fiscal_year', year)
        .order('created_at', { ascending: false });
    }

    async function retry<T>(fn: () => Promise<T>, attempts = 3, delayMs = 250): Promise<T> {
      let lastErr: unknown;
      for (let i = 0; i < attempts; i++) {
        try {
          // eslint-disable-next-line no-await-in-loop
          return await fn();
        } catch (e) {
          lastErr = e;
          // eslint-disable-next-line no-await-in-loop
          await new Promise(res => setTimeout(res, delayMs * (i + 1)));
        }
      }
      throw lastErr;
    }

    try {
      const res = await retry(() => tryClient());
      if (res && typeof res === 'object') {
        const rec = res as unknown as Record<string, unknown>;
        if (rec.error) throw rec.error;
        if (rec.data) return rec.data;
      }
    } catch (e) {
      console.warn('[financeService] client getMyFinance retry failed, falling back to server', String(e));
    }

    // Server fallback
    try {
      const r = await fetch(`/api/finance/my?year=${encodeURIComponent(String(year))}`, { credentials: 'include' });
      if (!r.ok) throw new Error(`server fallback failed ${r.status}`);
      const body = await r.json();
      return body.data ?? [];
    } catch (e) {
      console.error('[financeService] getMyFinance fallback error', String(e));
      throw e;
    }
  },

  // Tổng phải thu (pending) trong năm
  async getTotalPendingIncome(year: number) {
    const client = typeof window === 'undefined' ? getSupabaseServiceClient() : supabase;
    const { data, error } = await client.rpc('get_total_pending_income', { year_input: year });
    if (error) throw error;
    const value = data as unknown;
    return typeof value === 'number' ? value : Number(value ?? 0);
  },

  // Lấy số dư quỹ hiện tại (RPC -> get_club_balance)
  async getClubBalance(year: number) {
    const client = typeof window === 'undefined' ? getSupabaseServiceClient() : supabase;
    const { data, error } = await client.rpc('get_club_balance', { year_input: year });
    if (error) throw error;
    const value = data as unknown;
    return typeof value === 'number' ? value : Number(value ?? 0);
  },
/*
  // Server-friendly helper which accepts a Supabase client (service or server client)
  async getClubBalanceWithClient(client: any, year: number) {
    if (!client || typeof client.rpc !== 'function') {
      throw new Error('Invalid supabase client provided');
    }
    const { data, error } = await client.rpc('get_club_balance', { year_input: year });
    if (error) throw error;
    const value = data as unknown;
    return typeof value === 'number' ? value : Number(value ?? 0);
  },
*/
  // Tạo hoặc cập nhật số dư đầu kỳ cho năm tiếp theo (RPC -> create_opening_balance)
  async createOpeningBalance(prevYear: number) {
    const client = typeof window === 'undefined' ? getSupabaseServiceClient() : supabase;
    const { error } = await client.rpc('create_opening_balance', { prev_year: prevYear });
    if (error) throw error;
    return { success: true };
  },

  // Lấy số dư đầu kỳ (OPENING_BALANCE) cho năm
  async getOpeningBalance(year: number) {
    type TxRow = { amount: number | string | null };
    const client = typeof window === 'undefined' ? getSupabaseServiceClient() : supabase;
    const { data, error } = await client
      .from('transactions')
      .select('amount, financial_categories(code)')
      .eq('fiscal_year', year)
      .eq('payment_status', 'paid')
      .eq('financial_categories.code', 'OPENING_BALANCE');

    if (error) throw error;
    const rows = data as TxRow[] | null;
    const total = (rows ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0);
    return total;
  },

  // 4. Tạo giao dịch (Dùng cho Admin hoặc Job tự động) dành cho đưa vào tổng kết race lấy mốc thưởng tiền mặt tự động, tổng kết thử thách, tính tiền thu quỹ đầu tháng. 
  async createTransaction(
    categoryCode: string,
    amount: number,
    description: string,
    userId: string | null = null,
    metadata: TransactionMetadata = {}
  ) {
    // Lấy ID danh mục
    const client = typeof window === 'undefined' ? getSupabaseServiceClient() : supabase;
    const { data: cat } = await client
      .from('financial_categories')
      .select('id')
      .eq('code', categoryCode)
      .maybeSingle();
      
    if (!cat) throw new Error('Danh mục không tồn tại');

    // Insert
    return await (typeof window === 'undefined' ? getSupabaseServiceClient() : supabase).from('transactions').insert({
      category_id: cat.id,
      user_id: userId,
      amount: amount,
      description: description,
      metadata: metadata,
      payment_status: 'pending', // Mặc định là nợ, nếu chi tiền mặt ngay thì update sau
      fiscal_year: new Date().getFullYear(),
      period_month: new Date().getMonth() + 1
    });
    
  }
};