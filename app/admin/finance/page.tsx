'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase-client';
import { useRouter } from 'next/navigation';
import { formatCurrency, formatDate } from '@/lib/utils';
import Link from 'next/link';
import { Plus, Search, Filter } from 'lucide-react';
import { financeService } from '@/lib/services/financeService';
import { useAuth } from "@/lib/auth/AuthContext";
import { getEffectiveRole, isAdminRole } from "@/lib/auth/role";


// 1. Định nghĩa Interface cho dữ liệu (Fix lỗi Line 10)
interface TransactionWithDetails {
  id: string;
  created_at: string;
  amount: number;
  description: string;
  payment_status: string; // Hoặc 'pending' | 'paid' | ...
  member_info?: {
    full_name: string;
  } | null;
  financial_categories?: {
    name: string;
    flow_type: 'in' | 'out';
    code: string;
  } | null;
}

// 2. Định nghĩa Props cho Component con (Fix lỗi Line 145)
interface KPICardProps {
  title: string;
  value: string | number;
  color: string;
}

export default function AdminFinanceDashboard() {
  const { user, isLoading: authLoading, sessionChecked } = useAuth();
  const router = useRouter();
  // use shared supabase singleton
  
  const [transactions, setTransactions] = useState<TransactionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [clubBalance, setClubBalance] = useState<number | null>(null);
  const [pendingIncome, setPendingIncome] = useState<number | null>(null);
  const [totalIncomeReal, setTotalIncomeReal] = useState<number | null>(null);
  const [totalExpense, setTotalExpense] = useState<number | null>(null);
  const [openingBalance, setOpeningBalance] = useState<number | null>(null);

  const checkRole = useCallback(async () => {
    if (!user) {
      router.push('/debug-login');
      return;
    }

    const userRole = getEffectiveRole(user);
    if (!userRole || (!isAdminRole(userRole) && userRole !== 'mod_finance')) {
      router.push('/');
    }
  }, [user, router]);

  useEffect(() => {
    if (authLoading || !sessionChecked) return;
    checkRole();
  }, [authLoading, sessionChecked, checkRole]);

  // Load toàn bộ giao dịch
  useEffect(() => {
     setLoading(true);
    if (authLoading || !sessionChecked) return;
    async function fetchAll() {
      const year = new Date().getFullYear();
      const [openingBal, clubBal, pending, incomeReal, expense, transRes] = await Promise.all([
        financeService.getOpeningBalance(year),
        financeService.getClubBalance(year),
        financeService.getTotalPendingIncome(year),
        financeService.getTotalIncomeReal(year),
        financeService.getTotalExpense(year),
        supabase
          .from('transactions')
          .select(`
            *,
            member_info:profiles!user_id(full_name),
            financial_categories(name, flow_type, code)
          `)
          .order('created_at', { ascending: false })
          .limit(100)
      ]);

      const opening = typeof openingBal === 'number' ? openingBal : Number(openingBal ?? 0);
      const club = typeof clubBal === 'number' ? clubBal : Number(clubBal ?? 0);
      const pendingNum = typeof pending === 'number' ? pending : Number(pending ?? 0);
      const incomeNum = typeof incomeReal === 'number' ? incomeReal : Number(incomeReal ?? 0);
      const expenseNum = typeof expense === 'number' ? expense : Number(expense ?? 0);

     // setStats({ opening_balance: opening, total_revenue: incomeNum, total_expense: expenseNum, current_balance: club });
      setOpeningBalance(opening);
      setClubBalance(club);
      setPendingIncome(pendingNum);
      setTotalIncomeReal(incomeNum);
      setTotalExpense(expenseNum);
      if (transRes.data) setTransactions(transRes.data as unknown as TransactionWithDetails[]);
      setLoading(false);
    }
    fetchAll();
  }, [authLoading, sessionChecked]);

  // Hành động xác nhận thu tiền nhanh
  const markAsPaid = async (id: string, flowType: string = 'in') => {
  // 1. Xác định câu hỏi xác nhận dựa trên loại dòng tiền
  const actionText = flowType === 'in' 
    ? 'đã THU TIỀN' 
    : 'đã CHI TIỀN / TRAO GIẢI';
    
  if(!confirm(`Xác nhận ${actionText} cho khoản này?`)) return;
  
  // 2. Gọi API update (Giữ nguyên)
  const { error } = await supabase
    .from('transactions')
    .update({ payment_status: 'paid', processed_at: new Date().toISOString() })
    .eq('id', id);
    
  if (!error) {
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, payment_status: 'paid' } : t));
  } else {
    alert("Có lỗi xảy ra, vui lòng thử lại.");
  }
};

 if (loading) return <div className="p-8">Đang tải bảng điều khiển...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Quản trị Tài chính</h1>
          <p className="text-gray-500">Quản lý thu chi và duyệt giao dịch</p>
        </div>
        <Link
          href="/admin/finance/create"
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition"
          style={{ background: 'var(--color-primary)', color: 'var(--color-text-inverse)' }}
        >
          <Plus size={18} /> Tạo Giao dịch Mới
        </Link>
      </div>

     {/* KPI CARDS - CẬP NHẬT THEO SỐ LIỆU CHUẨN TỪ VIEW */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {/* Card 1: Tổng Quỹ (Quan trọng nhất với Admin) */}
        <div className="p-4 rounded-xl bg-blue-600 text-white shadow-md">
          <p className="text-blue-100 text-sm font-medium">TỔNG QUỸ HIỆN CÓ</p>
          <p className="text-2xl font-bold mt-1">{formatCurrency(clubBalance ?? 0)}</p>
          <div className="mt-2 text-xs text-blue-200 flex justify-between">
            <span>Đầu kỳ: {formatCurrency(openingBalance ?? 0)}</span>
          </div>
        </div>

        {/* Card 2: Nợ phải thu (Pending) - Cái này tính từ list transactions hoặc gọi API riêng */}
        <KPICard 
          title="Nợ phải thu (Pending)" 
          value={formatCurrency(pendingIncome ?? 0)} 
          color="red" 
        />

        {/* Card 3: Thu Mới (Revenue) */}
        <KPICard 
          title="Thu Mới (Trong năm)" 
          value={formatCurrency(totalIncomeReal ?? 0)} 
          color="green" 
        />

        {/* Card 4: Tổng Chi */}
        <KPICard 
          title="Tổng Chi (Trong năm)" 
          value={formatCurrency(totalExpense ?? 0)} 
          color="orange" 
        />
      </div>

      {/* TABLE */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b flex gap-4 bg-gray-50">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
            <input type="text" placeholder="Tìm thành viên, nội dung..." className="pl-10 pr-4 py-2 border rounded-lg w-full text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <button className="flex items-center gap-2 px-3 py-2 border rounded-lg bg-white text-gray-600 hover:bg-gray-50">
            <Filter size={18} /> Bộ lọc
          </button>
        </div>

        <table className="w-full text-sm text-left">
          <thead className="bg-gray-100 text-gray-600 border-b">
            <tr>
              <th className="p-3">Ngày tạo</th>
              <th className="p-3">Thành viên</th>
              <th className="p-3">Danh mục</th>
              <th className="p-3">Nội dung</th>
              <th className="p-3 text-right">Số tiền</th>
              <th className="p-3 text-center">Trạng thái</th>
              <th className="p-3 text-center">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {transactions.map((t) => (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="p-3 text-gray-500">{formatDate(t.created_at)}</td>
                <td className="p-3 font-medium text-gray-800">
                  {t.member_info?.full_name || <span className="text-gray-400 italic">Chung (CLB)</span>}
                </td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded text-xs ${
                    t.financial_categories?.flow_type === 'in' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                  }`}>
                    {t.financial_categories?.name}
                  </span>
                </td>
                <td className="p-3 text-gray-600 max-w-xs truncate">{t.description}</td>
                <td className={`p-3 text-right font-medium ${
                  t.financial_categories?.flow_type === 'in' ? 'text-green-600' : 'text-orange-600'
                }`}>
                  {t.financial_categories?.flow_type === 'in' ? '+' : '-'}{formatCurrency(t.amount)}
                </td>
                <td className="p-3 text-center">
                   <StatusBadge status={t.payment_status} flowType={t.financial_categories?.flow_type} />
                </td>
                <td className="p-3 text-center">
                  {t.payment_status === 'pending' && (
                    <button 
                      // Truyền thêm flow_type vào hàm xử lý
                      onClick={() => markAsPaid(t.id, t.financial_categories?.flow_type || 'in')}
                      
                      className={`text-xs px-2 py-1 rounded border hover:opacity-80 transition font-medium ${
                        t.financial_categories?.flow_type === 'in'
                          ? 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100' // Màu xanh cho Thu
                          : 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100' // Màu cam cho Chi
                      }`}
                    >
                      {/* Logic hiển thị chữ trên nút */}
                      {t.financial_categories?.flow_type === 'in' ? 'Xác nhận thu' : 'Xác nhận chi'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Sub-components

// Thay 'any' bằng Interface KPICardProps
const KPICard = ({ title, value, color }: KPICardProps) => (
  <div className={`p-4 rounded-xl border-l-4 bg-white shadow-sm border border-gray-100`} style={{ borderLeftColor: color }}>
    <p className="text-gray-500 text-sm">{title}</p>
    <p className="text-xl font-bold text-gray-800 mt-1">{value}</p>
  </div>
);

// Component hiển thị trạng thái (Copy đè lên cái cũ ở cuối file)
const StatusBadge = ({ 
  status, 
  flowType 
}: { 
  status: string; 
  flowType?: 'in' | 'out' | string; // Thêm dấu ? để không lỗi nếu dữ liệu null
}) => {
  
  // 1. Logic chọn Chữ hiển thị (Label)
  let label = status;
  
  if (status === 'paid') {
    label = 'Hoàn thành';
  } else if (status === 'cancelled') {
    label = 'Đã hủy';
  } else if (status === 'pending') {
    // Nếu là Pending, kiểm tra xem là Thu (in) hay Chi (out)
    if (flowType === 'in') {
      label = 'Chờ thu';   // User chưa đóng tiền
    } else {
      label = 'Chờ chi';   // Admin chưa chi tiền/trao giải
    }
  }

  // 2. Logic chọn Màu sắc (Color)
  // Mặc định là xám (cho đã hủy/unknown)
  let colorClass = 'bg-gray-100 text-gray-500';

  if (status === 'paid') {
    colorClass = 'bg-green-100 text-green-700';
  } else if (status === 'rejected') {
    colorClass = 'bg-red-100 text-red-700';
  } else if (status === 'pending') {
    if (flowType === 'in') {
      // Pending IN: Màu cam (Cảnh báo cần thu tiền)
      colorClass = 'bg-orange-100 text-orange-700';
    } else {
      // Pending OUT: Màu xanh dương (Nhắc nhở Admin cần thực hiện chi)
      colorClass = 'bg-blue-100 text-blue-700';
    }
  }

  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold uppercase whitespace-nowrap ${colorClass}`}>
      {label}
    </span>
  );
};