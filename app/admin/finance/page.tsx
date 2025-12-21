'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
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
  profiles?: {
    full_name: string;
  } | null;
  financial_categories?: {
    name: string;
    flow_type: 'in' | 'out';
    code: string;
  } | null;
}

// Interface cho Stats
interface FundStats {
  opening_balance: number;
  total_revenue: number;
  total_expense: number;
  current_balance: number;
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
  const supabase = createClientComponentClient();
  
  const [transactions, setTransactions] = useState<TransactionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<FundStats | null>(null);

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
      const [statsData, transRes] = await Promise.all([
        financeService.getPublicStats(),
        supabase
          .from('transactions')
          .select(`
            *,
            profiles(full_name),
            financial_categories(name, flow_type, code)
          `)
          .order('created_at', { ascending: false })
          .limit(100)
      ]);

      if (statsData) setStats(statsData as unknown as FundStats);
      if (transRes.data) setTransactions(transRes.data as unknown as TransactionWithDetails[]);
      setLoading(false);
    }
    fetchAll();
  }, [supabase, authLoading, sessionChecked]);

  // Hành động xác nhận thu tiền nhanh
  const markAsPaid = async (id: string) => {
    if(!confirm('Xác nhận đã thu tiền khoản này?')) return;
    
    const { error } = await supabase
      .from('transactions')
      .update({ payment_status: 'paid', processed_at: new Date().toISOString() })
      .eq('id', id);
      
    if (!error) {
      setTransactions(prev => prev.map(t => t.id === id ? { ...t, payment_status: 'paid' } : t));
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
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition"
        >
          <Plus size={18} /> Tạo Giao dịch Mới
        </Link>
      </div>

     {/* KPI CARDS - CẬP NHẬT THEO SỐ LIỆU CHUẨN TỪ VIEW */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {/* Card 1: Tổng Quỹ (Quan trọng nhất với Admin) */}
        <div className="p-4 rounded-xl bg-blue-600 text-white shadow-md">
          <p className="text-blue-100 text-sm font-medium">TỔNG QUỸ HIỆN CÓ</p>
          <p className="text-2xl font-bold mt-1">{formatCurrency(stats?.current_balance || 0)}</p>
          <div className="mt-2 text-xs text-blue-200 flex justify-between">
            <span>Đầu kỳ: {formatCurrency(stats?.opening_balance || 0)}</span>
          </div>
        </div>

        {/* Card 2: Nợ phải thu (Pending) - Cái này tính từ list transactions hoặc gọi API riêng */}
        <KPICard 
          title="Nợ phải thu (Pending)" 
          value={formatCurrency(transactions.filter(t => t.payment_status === 'pending' && t.financial_categories?.flow_type === 'in').reduce((s, t) => s + t.amount, 0))} 
          color="red" 
        />

        {/* Card 3: Thu Mới (Revenue) */}
        <KPICard 
          title="Thu Mới (Trong năm)" 
          value={formatCurrency(stats?.total_revenue || 0)} 
          color="green" 
        />

        {/* Card 4: Tổng Chi */}
        <KPICard 
          title="Tổng Chi (Trong năm)" 
          value={formatCurrency(stats?.total_expense || 0)} 
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
                  {t.profiles?.full_name || <span className="text-gray-400 italic">Chung (CLB)</span>}
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
                   <StatusBadge status={t.payment_status} />
                </td>
                <td className="p-3 text-center">
                  {t.payment_status === 'pending' && (
                    <button 
                      onClick={() => markAsPaid(t.id)}
                      className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded border border-blue-200 hover:bg-blue-100"
                    >
                      Xác nhận thu
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

const StatusBadge = ({ status }: { status: string }) => {
  // 3. Khai báo kiểu Record<string, string> để fix lỗi Line 153
  const styles: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    paid: 'bg-green-100 text-green-700',
    cancelled: 'bg-gray-100 text-gray-500',
    rejected: 'bg-red-100 text-red-700'
  };
  
  // Fallback về pending nếu status lạ
  return <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase ${styles[status] || styles.pending}`}>{status}</span>
};