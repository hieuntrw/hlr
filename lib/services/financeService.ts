import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { TransactionMetadata } from '@/types/finance'

const supabase = createClientComponentClient();

// (Moved getClubBalance & createOpeningBalance into the financeService object below)


export const financeService = {
 
// Hàm mới: Lấy báo cáo theo danh mục và năm
  async getReportByCategory(year: number) {
    const { data, error } = await supabase
      .from('view_finance_report_by_category')
      .select('*')
      .eq('fiscal_year', year)
      .order('total_amount', { ascending: false }); // Sắp xếp số tiền lớn nhất lên đầu

    if (error) throw error;
    return data;
  },

  // 1. Lấy thống kê công khai 
  async getPublicStats() {
    const { data, error } = await supabase.from('view_public_fund_stats').select('*').maybeSingle();
    if (error) throw error;
    return data;
  },

  // Tổng chi trong năm (RPC -> get_total_expense)
  async getTotalExpense(year: number) {
    const { data, error } = await supabase.rpc('get_total_expense', { year_input: year });
    if (error) throw error;
    const value = data as unknown;
    return typeof value === 'number' ? value : Number(value ?? 0);
  },

  // 2. Lấy danh sách chi tiêu công khai
  async getRecentExpenses() {
    const { data, error } = await supabase.from('view_public_recent_expenses').select('*');
    if (error) throw error;
    return data;
  },

  // Tổng thu thực tế trong năm (loại bỏ OPENING_BALANCE)
  async getTotalIncomeReal(year: number) {
    const { data, error } = await supabase.rpc('get_total_income_real', { year_input: year });
    if (error) throw error;
    const value = data as unknown;
    return typeof value === 'number' ? value : Number(value ?? 0);
  },

  // 3. Lấy tài chính cá nhân
  async getMyFinance(userId: string, year: number) {
    const { data, error } = await supabase
      .from('view_my_finance_status')
      .select('*')
      .eq('user_id', userId)
      .eq('fiscal_year', year)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  // Tổng phải thu (pending) trong năm
  async getTotalPendingIncome(year: number) {
    const { data, error } = await supabase.rpc('get_total_pending_income', { year_input: year });
    if (error) throw error;
    const value = data as unknown;
    return typeof value === 'number' ? value : Number(value ?? 0);
  },

  // Lấy số dư quỹ cho năm (RPC -> get_club_balance)
  async getClubBalance(year: number) {
    const { data, error } = await supabase.rpc('get_club_balance', { year_input: year });
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
    const { error } = await supabase.rpc('create_opening_balance', { prev_year: prevYear });
    if (error) throw error;
    return { success: true };
  },

  // Lấy số dư đầu kỳ (OPENING_BALANCE) cho năm
  async getOpeningBalance(year: number) {
    type TxRow = { amount: number | string | null };
    const { data, error } = await supabase
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
    const { data: cat } = await supabase
      .from('financial_categories')
      .select('id')
      .eq('code', categoryCode)
      .maybeSingle();
      
    if (!cat) throw new Error('Danh mục không tồn tại');

    // Insert
    return await supabase.from('transactions').insert({
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