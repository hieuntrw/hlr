import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { TransactionMetadata } from '@/types/finance'

const supabase = createClientComponentClient();

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
    const { data, error } = await supabase.from('view_public_fund_stats').select('*').single();
    if (error) throw error;
    return data;
  },

  // 2. Lấy danh sách chi tiêu công khai
  async getRecentExpenses() {
    const { data, error } = await supabase.from('view_public_recent_expenses').select('*');
    if (error) throw error;
    return data;
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

  // 4. Tạo giao dịch (Dùng cho Admin hoặc Job tự động) dành cho 
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
      .single();
      
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