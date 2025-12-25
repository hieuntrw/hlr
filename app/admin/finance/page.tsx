'use client';

import { useEffect, useState, useCallback } from 'react';
// supabase client not used in admin page anymore; server APIs handle transactions
import { useRouter } from 'next/navigation';
import { formatCurrency } from '@/lib/utils';
import Link from 'next/link';
import { Plus } from 'lucide-react';
// financeService not needed for totals here; using server totals endpoint
import { useAuth } from "@/lib/auth/AuthContext";
import { getEffectiveRole, isAdminRole } from "@/lib/auth/role";


// Transaction shape is queried from server view; define a minimal interface
// to avoid `any` and satisfy ESLint.
interface Transaction {
  transaction_id?: number | string;
  id: number | string;
  created_at: string;
  member_info?: { full_name?: string } | null;
  description?: string | null;
  category_name?: string | null;
  category_code?: string | null;
  amount?: number | null;
  payment_status?: string | null;
  flow_type?: 'in' | 'out' | string | null;
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
  
  const [clubBalance, setClubBalance] = useState<number | null>(null);
  const [pendingTotal, setPendingTotal] = useState<number | null>(null);
  const [incomeTotal, setIncomeTotal] = useState<number | null>(null);
  const [expenseTotal, setExpenseTotal] = useState<number | null>(null);
  const [openingBalance, setOpeningBalance] = useState<number | null>(null);
  const [selectedKPI, setSelectedKPI] = useState<'pending' | 'income' | 'expense' | null>(null);
  const [fiscalYear, setFiscalYear] = useState<number>(new Date().getFullYear());
  const [totalsLoading, setTotalsLoading] = useState(true);
  // Filters that will be used by server-side query (you will implement loading logic)
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string | null>(null);
  const [flowTypeFilter, setFlowTypeFilter] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [txLoading, setTxLoading] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  
  // loadFiltered is a reusable fetch so actions can refresh the list
  const loadFiltered = useCallback(async () => {
    if (authLoading || !sessionChecked || !user) return;
    setTxLoading(true);
    setTxError(null);
    try {
      const params = new URLSearchParams();
      params.set('year', String(fiscalYear));
      if (paymentStatusFilter) params.set('status', paymentStatusFilter);
      if (flowTypeFilter) params.set('flow_type', flowTypeFilter);
      const resp = await fetch(`/api/finance/transactions?${params.toString()}`, { credentials: 'include' });
      const body = await (resp.ok ? resp.json() : Promise.resolve({ ok: false, error: 'Request failed' }));
      if (!resp.ok) {
        setTxError(body?.error ?? 'Server error');
        setTransactions([]);
      } else {
        const rows = (body?.data ?? []) as Array<Record<string, unknown> & { transaction_id?: number | string; id?: number | string }>;
        const normalized = rows.map(r => ({ ...(r || {}), id: (r.transaction_id ?? r.id) }));
        setTransactions(normalized as Transaction[]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : (typeof err === 'object' ? JSON.stringify(err) : String(err));
      setTxError(msg);
      setTransactions([]);
    } finally {
      setTxLoading(false);
    }
  }, [authLoading, sessionChecked, user, fiscalYear, paymentStatusFilter, flowTypeFilter]);

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

  // load more transactions when scrolling near bottom
 

  // load more transactions when scrolling near bottom
  // transaction listing responsibility removed from client — server-side view will be used.

  // Load toàn bộ giao dịch (use ref-held fetchTransactions to avoid re-running
  // when fetchTransactions identity changes)
  useEffect(() => {
    if (authLoading || !sessionChecked || !user) return;
    setTotalsLoading(true);
    async function fetchAll() {
      const year = fiscalYear;
      console.debug('[admin/finance] active filters', { paymentStatusFilter, flowTypeFilter });
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

      // transaction list loading removed — client only shows KPI cards now
      setTotalsLoading(false);
    }
    fetchAll();
  }, [authLoading, sessionChecked, user, fiscalYear, paymentStatusFilter, flowTypeFilter]);

  // Fetch filtered transactions when filters/year change
  useEffect(() => {
    loadFiltered();
  }, [loadFiltered]);

  // Action handlers (approve/reject) call server and refresh list
  const handleAction = useCallback(async (action: 'approve' | 'reject' | 'view', tx: Transaction) => {
    if (action === 'view') {
      const targetId = tx.id ?? tx.transaction_id;
      if (!targetId) {
        console.error('Missing transaction id for view action', tx);
        return;
      }
      router.push(`/admin/finance/${targetId}`);
      return;
    }
    setTxLoading(true);
    setTxError(null);
    try {
      const updates: Partial<{ payment_status: string }> = {};
      if (action === 'approve') updates.payment_status = 'paid';
      if (action === 'reject') updates.payment_status = 'Cancelled';
      const resp = await fetch('/api/finance/transactions', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: tx.id, updates }),
      });
      const body = await (resp.ok ? resp.json() : Promise.resolve({ ok: false, error: 'Request failed' }));
      if (!resp.ok || !body?.ok) {
        setTxError(body?.error ?? 'Action failed');
      } else {
        await loadFiltered();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : (typeof err === 'object' ? JSON.stringify(err) : String(err));
      setTxError(msg);
    } finally {
      setTxLoading(false);
    }
  }, [router, loadFiltered]);


  // Transaction actions removed from client; KPI clicks update filter state only

  // KPI numbers are provided by `/api/finance/totals` (stored in pendingTotal, incomeTotal, expenseTotal)

  // No client-side transaction list loading: leave server query implementation to you.

 if (totalsLoading) return <div className="p-8">Đang tải bảng điều khiển...</div>;

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

        {/* Card 2: Nợ phải thu (Pending) */}
        <button
          type="button"
          onClick={() => {
            setSelectedKPI('pending');
            setPaymentStatusFilter('pending');
            setFlowTypeFilter('in');
          }}
        >
          <KPICard title="Nợ phải thu (pending)" value={formatCurrency(pendingTotal ?? 0)} color="red" active={selectedKPI === 'pending'} />
        </button>
        <button
          type="button"
          onClick={() => {
            setSelectedKPI('income');
            setPaymentStatusFilter('paid');
            setFlowTypeFilter('in');
          }}
        >
          <KPICard title="Thu mới (Trong năm)" value={formatCurrency(incomeTotal ?? 0)} color="green" active={selectedKPI === 'income'} />
        </button>
        <button
          type="button"
          onClick={() => {
            setSelectedKPI('expense');
            setPaymentStatusFilter('paid');
            setFlowTypeFilter('out');
          }}
        >
          <KPICard title="Tổng chi (Trong năm)" value={formatCurrency(expenseTotal ?? 0)} color="orange" active={selectedKPI === 'expense'} />
        </button>
      </div>

      {/* Transaction table/loading removed — client shows only KPI controls */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b flex gap-4 bg-gray-50">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-white border p-1 rounded-lg shadow-sm">
              <span className="pl-3 text-sm text-gray-500 font-medium">Năm tài chính:</span>
              <select
                value={fiscalYear}
                onChange={(e) => setFiscalYear(Number(e.target.value))}
                className="p-2 bg-transparent font-bold text-gray-800 outline-none cursor-pointer"
              >
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 4 + i).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500">Trạng thái:</label>
              <select
                value={paymentStatusFilter ?? ''}
                onChange={(e) => setPaymentStatusFilter(e.target.value ? e.target.value : null)}
                className="p-2 bg-white border rounded-md text-sm"
              >
                <option value="">Tất cả</option>
                <option value="pending">Chờ (pending)</option>
                <option value="paid">Đã thanh toán (paid)</option>
                <option value="cancelled">Đã hủy (cancelled)</option>
               </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500">Loại dòng tiền:</label>
              <select
                value={flowTypeFilter ?? ''}
                onChange={(e) => setFlowTypeFilter(e.target.value ? e.target.value : null)}
                className="p-2 bg-white border rounded-md text-sm"
              >
                <option value="">Tất cả</option>
                <option value="in">Thu (in)</option>
                <option value="out">Chi (out)</option>
              </select>
            </div>
            <button onClick={() => { setPaymentStatusFilter(null); setFlowTypeFilter(null); setSelectedKPI(null); }} className="px-3 py-2 border rounded-lg bg-white text-gray-600 hover:bg-gray-50">Reset</button>
          </div>
        </div>
        <div className="p-6 text-sm text-gray-600">
          <div className="mb-3">Danh sách giao dịch giờ được load bởi server; client chỉ điều khiển filter `payment_status` và `flow_type` từ các KPI.</div>
          {txLoading ? (
            <div>Đang tải danh sách giao dịch...</div>
          ) : txError ? (
            <div className="text-red-600">Lỗi: {typeof txError === 'object' ? JSON.stringify(txError) : txError}</div>
          ) : transactions && transactions.length === 0 ? (
            <div>Không có giao dịch khớp điều kiện.</div>
          ) : transactions ? (
            <div className="overflow-x-auto">
              <div className="max-h-[48rem] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-gray-600">
                    <tr>
                      <th className="py-2 w-32">Ngày</th>
                      <th className="py-2 w-56">Thành viên</th>
                      <th className="py-2 text-center w-1/3">Mô tả</th>
                      <th className="py-2 w-25">Danh mục</th>
                      <th className="py-2 w-30 text-center">Số tiền</th>
                      <th className="py-2 w-30 text-nowrap">Trạng thái</th>
                      <th className="py-2 w-20">Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((t: Transaction) => (
                      <tr key={t.id} className="border-t">
                        <td className="py-2">{new Date(t.created_at).toLocaleDateString('en-GB')}</td>
                        <td className="py-2 font-bold">{t.member_info?.full_name ?? '-'}</td>
                        <td className="py-2 text-left">{t.description ?? '-'}</td>
                        <td className="py-2">{t.category_name ?? t.category_code ?? '-'}</td>
                        <td className="py-2 text-right pr-6">
                          {t.flow_type === 'in' ? (
                            <span className="text-green-700">+{formatCurrency(Number(t.amount ?? 0))}</span>
                          ) : (
                            <span className="text-red-700">-{formatCurrency(Number(t.amount ?? 0))}</span>
                          )}
                        </td>
                        <td className="py-2 text-nowrap"><StatusBadge status={t.payment_status ?? ''} flowType={t.flow_type ?? undefined} /></td>
                        <td className="py-2">
                          <div className="flex gap-2 itiems-right">
                            <div className="w-20 text-right pr-6">
                              {t.payment_status === 'pending' ? (
                                <button onClick={() => handleAction('approve', t)} className="px-2 py-1 bg-green-600 text-white rounded-md text-xs">{getStatusLabel(t.payment_status ?? '', t.flow_type)}</button>
                              ) : t.payment_status === 'paid' ? (
                                null
                              ) : (
                                <button onClick={() => handleAction('view', t)} className="px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs">{getStatusLabel(t.payment_status ?? '', t.flow_type)}</button>
                              )}
                            </div>
                            <div className="w-10">
                              <button onClick={() => {
                                const targetId = t.id ?? t.transaction_id;
                                if (!targetId) return console.error('Missing transaction id for edit', t);
                                router.push(`/admin/finance/${targetId}`);
                              }} className="px-2 py-1 bg-blue-50 text-blue-700 rounded-md text-xs">Sửa</button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
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

// StatusBadge 

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
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>
      {label}
    </span>
  );

};


// Utility: return the textual label used by StatusBadge (reused for action labels)
function getStatusLabel(status: string | null | undefined, flowType?: string | null) {
  let label = status ?? '';
  if (status === 'paid') {
    label = 'Hoàn thành';
  } else if (status === 'cancelled') {
    label = 'Đã hủy';
  } else if (status === 'pending') {
    if (flowType === 'in') {
      label = 'Đã thu';
    } else {
      label = 'Đã chi';
    }
  }
  return label;
}

