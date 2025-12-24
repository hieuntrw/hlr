'use client';

import { useEffect, useState, useCallback } from 'react';
// supabase client not used in admin page anymore; server APIs handle transactions
import { useRouter } from 'next/navigation';
import { formatCurrency, formatDate } from '@/lib/utils';
import Link from 'next/link';
import { Plus } from 'lucide-react';
// financeService not needed for totals here; using server totals endpoint
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
  fiscal_year?: number | null;
}

// 2. Định nghĩa Props cho Component con (Fix lỗi Line 145)
interface KPICardProps {
  title: string;
  value: string | number;
  color: string;
  active?: boolean;
}

export default function AdminFinanceDashboard() {
  const { user, isLoading: authLoading, sessionChecked } = useAuth();
  const router = useRouter();
  // use shared supabase singleton
  
  const [transactions, setTransactions] = useState<TransactionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const pageSize = 50;
  const [hasMore, setHasMore] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterFlow, setFilterFlow] = useState<string>('');
  const [clubBalance, setClubBalance] = useState<number | null>(null);
  const [pendingTotal, setPendingTotal] = useState<number | null>(null);
  const [incomeTotal, setIncomeTotal] = useState<number | null>(null);
  const [expenseTotal, setExpenseTotal] = useState<number | null>(null);
  const [openingBalance, setOpeningBalance] = useState<number | null>(null);
  const [excludeOpening, setExcludeOpening] = useState(false);
  const [selectedKPI, setSelectedKPI] = useState<'pending' | 'income' | 'expense' | null>(null);

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
    if (authLoading || !sessionChecked || !user) return;
    checkRole();
  }, [authLoading, sessionChecked, checkRole, user]);

  // Load toàn bộ giao dịch
  useEffect(() => {
    if (authLoading || !sessionChecked || !user) return;
    setLoading(true);
    async function fetchAll() {
      const year = new Date().getFullYear();
      const totalsResp = await fetch(`/api/finance/totals?year=${year}`, { credentials: 'include' });
      const totalsBody = await (totalsResp.ok ? totalsResp.json() : Promise.resolve({ ok: false }));
      const totals = totalsBody?.totals ?? null;
      const opening = totals ? Number(totals.openingBalance ?? 0) : 0;
      const club = totals ? Number(totals.clubBalance ?? 0) : 0;
      const pending = totals ? Number(totals.pendingIncome ?? 0) : 0;
      const income = totals ? Number(totals.totalIncomeReal ?? 0) : 0;
      const expense = totals ? Number(totals.totalExpense ?? 0) : 0;
      setOpeningBalance(opening);
      setClubBalance(club);
      setPendingTotal(pending);
      setIncomeTotal(income);
      setExpenseTotal(expense);

      // fetch first page of transactions (no year filter)
      await fetchTransactions(0, false);
      setLoading(false);
    }
    fetchAll();
  }, [authLoading, sessionChecked, user]);

  // load more transactions when scrolling near bottom
  const buildQuery = (off = 0, overrides?: { status?: string; flow?: string; excludeOpening?: boolean }) => {
    const qs = new URLSearchParams();
    qs.set('limit', String(pageSize));
    qs.set('offset', String(off));
    const status = overrides?.status ?? filterStatus;
    const flow = overrides?.flow ?? filterFlow;
    const excl = overrides?.excludeOpening ?? excludeOpening;
    if (status) qs.set('status', status);
    if (flow) qs.set('flow_type', flow);
    if (excl) qs.set('exclude_category_code', 'OPENING_BALANCE');
    return qs.toString();
  };

  const fetchTransactions = async (off = 0, append = false, overrides?: { status?: string; flow?: string; excludeOpening?: boolean }) => {
    if (loadingMore) return;
    if (append) setLoadingMore(true);
    else setLoading(true);
    try {
      const resp = await fetch(`/api/finance/transactions?${buildQuery(off, overrides)}`, { credentials: 'include' });
      const body = await (resp.ok ? resp.json() : Promise.resolve({ ok: false }));
      const rows = Array.isArray(body?.data) ? (body.data as TransactionWithDetails[]) : [];
      if (rows.length > 0) {
        if (append) setTransactions(prev => [...prev, ...rows]);
        else setTransactions(rows);
        setOffset(off + rows.length);
        setHasMore(rows.length >= pageSize);
      } else {
        if (!append) setTransactions([]);
        setHasMore(false);
      }
    } catch (e) {
      console.error('fetchTransactions error', e);
    } finally {
      if (append) setLoadingMore(false);
      else setLoading(false);
    }
  };

  const loadMore = () => {
    if (!hasMore || loadingMore) return;
    fetchTransactions(offset, true);
  };

  // Hành động xác nhận thu tiền nhanh
  const markAsPaid = async (id: string, flowType: string = 'in') => {
  // 1. Xác định câu hỏi xác nhận dựa trên loại dòng tiền
  const actionText = flowType === 'in' 
    ? 'đã THU TIỀN' 
    : 'đã CHI TIỀN / TRAO GIẢI';
    
  if(!confirm(`Xác nhận ${actionText} cho khoản này?`)) return;
  
  // 2. Gọi API update (Giữ nguyên)
  try {
    const r = await fetch('/api/finance/transactions', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, updates: { payment_status: 'paid', processed_at: new Date().toISOString() } }),
    });
    const body = await (r.ok ? r.json() : Promise.resolve({ ok: false, error: 'request failed' }));
    if (body && body.ok) {
      setTransactions(prev => prev.map(t => t.id === id ? { ...t, payment_status: 'paid' } : t));
    } else {
      alert('Có lỗi xảy ra, vui lòng thử lại.');
    }
  } catch (e) {
    console.error('markAsPaid error', String(e));
    alert('Có lỗi xảy ra, vui lòng thử lại.');
  }
};

  // KPI numbers are provided by `/api/finance/totals` (stored in pendingTotal, incomeTotal, expenseTotal)

  // Server-side filtered transactions are stored in `transactions`
  const displayedTransactions = transactions;

  // Debounce search/filter changes
  useEffect(() => {
    const t = setTimeout(() => {
      // reset offset and fetch fresh
      fetchTransactions(0, false);
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus, filterFlow, excludeOpening]);

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
        <button type="button" onClick={() => { setSelectedKPI('pending'); setFilterStatus('pending'); setFilterFlow(''); setExcludeOpening(false); fetchTransactions(0,false,{ status: 'pending', flow: '', excludeOpening: false }); }}>
          <KPICard title="Nợ phải thu (Pending)" value={formatCurrency(pendingTotal ?? 0)} color="red" active={selectedKPI === 'pending'} />
        </button>
        <button type="button" onClick={() => { setSelectedKPI('income'); setFilterStatus('paid'); setFilterFlow('in'); setExcludeOpening(true); fetchTransactions(0,false,{ status: 'paid', flow: 'in', excludeOpening: true }); }}>
          <KPICard title="Thu Mới (Trong năm)" value={formatCurrency(incomeTotal ?? 0)} color="green" active={selectedKPI === 'income'} />
        </button>
        <button type="button" onClick={() => { setSelectedKPI('expense'); setFilterStatus('paid'); setFilterFlow('out'); setExcludeOpening(false); fetchTransactions(0,false,{ status: 'paid', flow: 'out', excludeOpening: false }); }}>
          <KPICard title="Tổng Chi (Trong năm)" value={formatCurrency(expenseTotal ?? 0)} color="orange" active={selectedKPI === 'expense'} />
        </button>
      </div>

      {/* TABLE */}
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b flex gap-4 bg-gray-50">
          <div className="flex items-center gap-2">
            <select value={filterFlow} onChange={e => setFilterFlow(e.target.value)} className="border rounded px-2 py-1 text-sm">
              <option value="">Tất cả loại</option>
              <option value="in">Thu (in)</option>
              <option value="out">Chi (out)</option>
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="border rounded px-2 py-1 text-sm">
              <option value="">Tất cả trạng thái</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <button onClick={() => { setFilterFlow(''); setFilterStatus(''); setExcludeOpening(false); setSelectedKPI(null); fetchTransactions(0,false); }} className="px-3 py-2 border rounded-lg bg-white text-gray-600 hover:bg-gray-50">Reset</button>
          
          </div>
        </div>
        <div className="max-h-[60vh] overflow-auto" onScroll={(e) => {
            const el = e.currentTarget as HTMLElement;
            if (el.scrollHeight - el.scrollTop <= el.clientHeight + 200) {
              loadMore();
            }
          }}>
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
            {displayedTransactions.map((t) => (
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
                <td className={`p-3 text-right font-medium ${t.financial_categories?.flow_type === 'in' ? 'text-green-600' : 'text-orange-600'}`}>
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
            {loadingMore && (
              <tr><td colSpan={7} className="p-4 text-center text-sm text-gray-500">Đang tải thêm...</td></tr>
            )}
          </tbody>
          </table>
        </div>
        {!hasMore && (
          <div className="p-3 text-center text-xs text-gray-500">Không còn giao dịch để tải.</div>
        )}
      </div>
    </div>
  );
}

// Sub-components

// Thay 'any' bằng Interface KPICardProps
const KPICard = ({ title, value, color, active = false }: KPICardProps) => (
  <div
    className={`p-4 rounded-xl border-l-4 bg-white shadow-sm border ${active ? 'ring-2 ring-offset-1 ring-indigo-200' : 'border-gray-100'}`}
    style={{ borderLeftColor: color }}
  >
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