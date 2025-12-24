'use client';

import { useEffect, useState } from 'react';
// supabase client not used directly in this component
import { useAuth } from '@/lib/auth/AuthContext';
import { formatCurrency, formatDate } from '@/lib/utils';
// Use server APIs for member finance to avoid client-side session race
// financeService no longer required for totals (server endpoint used)
import { CreditCard, History, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react';

// 1. Định nghĩa các Interface để thay thế 'any'
interface MyTransaction {
  transaction_id: string;
  category_name: string;
  description: string | null;
  created_at: string;
  flow_type: 'in' | 'out';
  amount: number;
  payment_status: string;
}
/*
interface FundStats {
  current_balance: number;
  total_income: number;
  total_expense: number;
}
*/
interface PublicExpense {
  payment_date: string;
  category_name: string;
  description: string | null;
  amount: number;
}
// 1. CẬP NHẬT INTERFACE MỚI
/*
interface FundStats {
  fiscal_year: number;
  opening_balance: number; // Mới
  total_revenue: number;   // Đổi tên từ total_income cho chuẩn nghĩa "Thu mới"
  total_expense: number;
  current_balance: number;
}
  */
export default function MemberFinancePage() {
  const [activeTab, setActiveTab] = useState<'personal' | 'public'>('personal');
  
  // 2. Sử dụng Interface thay vì any[]
  const [myTrans, setMyTrans] = useState<MyTransaction[]>([]);
    const [publicExpenses, setPublicExpenses] = useState<PublicExpense[]>([]);
  const [clubBalance, setClubBalance] = useState<number | null>(null);
   const [totalIncomeReal, setTotalIncomeReal] = useState<number | null>(null);
  const [totalExpense, setTotalExpense] = useState<number | null>(null);
  const [openingBalance, setOpeningBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const { user, sessionChecked } = useAuth();

  // Helper: normalize and map transactions rows to PublicExpense with diagnostics
  const mapTransactionsToExpenses = (rowsIn: Record<string, unknown>[]) => {
    const rows = rowsIn ?? [];
    const total = rows.length;
    let outCandidates = 0;
    let paidCount = 0;
    const mapped: PublicExpense[] = [];

    for (const row of rows) {
      const fc = row.financial_categories as Record<string, unknown> | Array<Record<string, unknown>> | null;

      // Extract category id from several possible shapes
      let categoryId: unknown = undefined;
      if (fc && typeof fc === 'object') {
        if (Array.isArray(fc) && fc.length > 0 && fc[0] && typeof fc[0] === 'object') categoryId = (fc[0] as Record<string, unknown>).id ?? (fc[0] as Record<string, unknown>).category_id ?? (fc[0] as Record<string, unknown>).financial_category_id;
        else if (!Array.isArray(fc)) categoryId = (fc as Record<string, unknown>).id ?? (fc as Record<string, unknown>).category_id ?? (fc as Record<string, unknown>).financial_category_id;
      }
      if (categoryId === undefined) categoryId = row.category_id ?? row.financial_category_id ?? row.categoryId;

      // Extract category name
      let categoryName = '';
      if (fc && typeof fc === 'object') {
        if (Array.isArray(fc) && fc.length > 0 && fc[0] && typeof fc[0] === 'object') categoryName = String((fc[0] as Record<string, unknown>).name ?? (fc[0] as Record<string, unknown>).title ?? '');
        else if (!Array.isArray(fc)) categoryName = String((fc as Record<string, unknown>).name ?? (fc as Record<string, unknown>).title ?? '');
      }
      if (!categoryName) categoryName = String(row.category_name ?? row.category ?? '');

      // Flow and status (normalize various shapes)
      const flow = String(row.flow_type ?? row.flow ?? (fc && ((Array.isArray(fc) ? (fc[0] as Record<string, unknown>)['flow_type'] : (fc as Record<string, unknown>)['flow_type']) ?? undefined)) ?? '').toLowerCase();
      const rawStatus = row.payment_status ?? row.status ?? row.status_name ?? row.paymentStatus ?? row.transaction_status ?? null;
      let payment_status = '';
      if (rawStatus === null || rawStatus === undefined) payment_status = '';
      else if (typeof rawStatus === 'string') payment_status = rawStatus.toLowerCase();
      else if (typeof rawStatus === 'number') payment_status = String(rawStatus);
      else if (typeof rawStatus === 'boolean') payment_status = rawStatus ? 'paid' : 'pending';
      const amount = Number(row.amount ?? row.value ?? 0) || 0;
      const payment_date = String(row.processed_at ?? row.payment_date ?? row.created_at ?? '');

      if (flow === 'out') outCandidates++;

      // Determine paid status from multiple possible representations
      const paidValues = new Set(['paid', 'completed', 'settled', 'success', 'confirmed', 'done']);
      const numericPaid = payment_status === '1' || payment_status === 'true';
      const boolPaid = Boolean(row.paid === true || row.is_paid === true || row.payment_confirmed === true);
      const isPaid = paidValues.has(payment_status) || numericPaid || boolPaid;
      if (isPaid) paidCount++;

      if (flow === 'out' && isPaid && categoryId) {
        mapped.push({ payment_date, category_name: categoryName, description: row.description ? String(row.description) : null, amount });
      }
    }

    console.log('[MemberFinance] mapping diagnostics (normalized):', { total, outCandidates, paidCount, mappedCount: mapped.length });

    if (mapped.length > 0) return mapped;

    // If we had out candidates but no mapped rows, log those raw rows for inspection
    if (outCandidates > 0 && mapped.length === 0) {
      try {
        const outRows = rowsIn
          .map(r => r as Record<string, unknown>)
          .filter(row => {
            const fc = row.financial_categories as Record<string, unknown> | Record<string, unknown>[] | null;
            const flow = String(row.flow_type ?? row.flow ?? (fc && ((Array.isArray(fc) ? (fc[0] as Record<string, unknown>)['flow_type'] : (fc as Record<string, unknown>)['flow_type']) ?? undefined)) ?? '').toLowerCase();
            return flow === 'out';
          })
          .slice(0, 5);
        console.log('[MemberFinance] out-candidate sample rows (unmapped):', JSON.stringify(outRows, null, 2));
      } catch (e) {
        console.log('[MemberFinance] failed logging out-candidates', e);
      }
    }

    // fallback: include paid items with amount>0 and category id if any
    const fallback = rows
      .filter((row) => {
        const payment_status = String(row.payment_status ?? row.status ?? '').toLowerCase();
        const amount = Number(row.amount ?? row.value ?? 0) || 0;
        // detect category id similarly
        const fc = row.financial_categories as Record<string, unknown> | Record<string, unknown>[] | null;
        let categoryId: unknown = undefined;
        if (fc && typeof fc === 'object') {
          if (Array.isArray(fc) && fc.length > 0 && fc[0] && typeof fc[0] === 'object') categoryId = (fc[0] as Record<string, unknown>).id ?? (fc[0] as Record<string, unknown>).category_id ?? (fc[0] as Record<string, unknown>).financial_category_id;
          else if (!Array.isArray(fc)) categoryId = (fc as Record<string, unknown>).id ?? (fc as Record<string, unknown>).category_id ?? (fc as Record<string, unknown>).financial_category_id;
        }
        if (categoryId === undefined) categoryId = row.category_id ?? row.financial_category_id ?? row.categoryId;
        return payment_status === 'paid' && amount > 0 && Boolean(categoryId);
      })
      .map((row) => {
        const fc = row.financial_categories as Record<string, unknown> | Record<string, unknown>[] | null;
        let categoryName = '';
        if (fc && typeof fc === 'object') {
          if (Array.isArray(fc) && fc.length > 0 && fc[0] && typeof fc[0] === 'object') categoryName = String((fc[0] as Record<string, unknown>).name ?? (fc[0] as Record<string, unknown>).title ?? '');
          else if (!Array.isArray(fc)) categoryName = String((fc as Record<string, unknown>).name ?? (fc as Record<string, unknown>).title ?? '');
        }
        if (!categoryName) categoryName = String(row.category_name ?? row.category ?? '');
        return { payment_date: String(row.processed_at ?? row.payment_date ?? row.created_at ?? ''), category_name: categoryName, description: row.description ? String(row.description) : null, amount: Number(row.amount ?? row.value ?? 0) || 0 };
      });

    console.log('[MemberFinance] fallback mapped count (normalized):', fallback.length, fallback.slice(0, 3));
    return fallback;
  };

  useEffect(() => {
    async function loadData() {
      try {
        if (!sessionChecked) return;
        if (!user) { setLoading(false); return; }

        // Load dữ liệu song song: cá nhân + các báo cáo/thu/chi/số dư từ financeService
        const year = new Date().getFullYear();
        // Call server endpoints for member-specific lists and totals only.
        const [transResp, totalsResp] = await Promise.all([
          fetch(`/api/finance/my?year=${year}`, { credentials: 'include' }),
          fetch(`/api/finance/totals?year=${year}`, { credentials: 'include' }),
        ]);

        const transBody = await (transResp.ok ? transResp.json() : Promise.resolve({ ok: false }));
        const transData: unknown = transBody.data ?? transBody.transactions ?? [];

        const totalsBody = await (totalsResp.ok ? totalsResp.json() : Promise.resolve({ ok: false }));
        const totals = (totalsBody && totalsBody.totals) ? totalsBody.totals : null;

        // Public transactions are loaded only when the user opens the public tab.
        const expensesData: unknown = [];

        // Ép kiểu dữ liệu trả về từ service (nếu service trả về unknown/any)
        if (Array.isArray(transData)) setMyTrans(transData as MyTransaction[]);
        else setMyTrans([]);
        if (Array.isArray(expensesData)) {
          console.log('[MemberFinance] mapped publicExpenses count:', (expensesData as unknown[]).length, expensesData);
          setPublicExpenses(expensesData as PublicExpense[]);
        } else {
          console.log('[MemberFinance] mapped publicExpenses empty or invalid:', expensesData);
          setPublicExpenses([]);
        }

        
        const opening = totals ? Number(totals.openingBalance ?? 0) : 0;
        const club = totals ? Number(totals.clubBalance ?? 0) : 0;
        const incomeNum = totals ? Number(totals.totalIncomeReal ?? 0) : 0;
        const expenseNum = totals ? Number(totals.totalExpense ?? 0) : 0;

      setOpeningBalance(opening);
      setClubBalance(club);
      setTotalIncomeReal(incomeNum);
      setTotalExpense(expenseNum);
              
      } catch (error) {
        console.error("Lỗi tải dữ liệu:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [sessionChecked, user]);

  // Fetch public expenses when user switches to the public tab (in case initial load skipped)
  useEffect(() => {
    if (activeTab !== 'public') return;
    if (!sessionChecked) return;
    if (!user) return;
    if (publicExpenses.length > 0) {
      console.debug('[MemberFinance] publicExpenses already loaded, skipping fetch');
      return;
    }

    async function loadPublicOnly() {
      console.debug('[MemberFinance] loading public expenses (tab switch)');
      try {
        const year = new Date().getFullYear();
        const resp = await fetch(`/api/finance/transactions?year=${year}&limit=500`, { credentials: 'include' });
        if (!resp.ok) {
          const txt = await resp.text().catch(() => '');
          console.error('[MemberFinance] /api/finance/transactions failure', resp.status, txt);
          setPublicExpenses([]);
          return;
        }
        const body = await resp.json().catch(() => ({ ok: false }));
        const raw: unknown = (body as Record<string, unknown>)?.data ?? [];
        if (!Array.isArray(raw)) {
          console.debug('[MemberFinance] public fetch returned non-array', raw);
          setPublicExpenses([]);
          return;
        }

        console.debug('[MemberFinance] raw expenses count (tab fetch):', raw.length, (raw as unknown[]).slice(0,3));

        const mapped = mapTransactionsToExpenses(raw as Record<string, unknown>[]);
        console.log('[MemberFinance] mapped publicExpenses (tab fetch) count:', mapped.length, (mapped as PublicExpense[]).slice(0,3));
        setPublicExpenses(mapped as PublicExpense[]);
      } catch (err) {
        console.error('[MemberFinance] error loading public expenses (tab fetch)', err);
        setPublicExpenses([]);
      }
    }

    void loadPublicOnly();
  }, [activeTab, sessionChecked, user, publicExpenses.length]);

  // Tính tổng nợ (Pending + Loại là Thu)
  const totalDebt = myTrans
    .filter(t => t.payment_status === 'pending' && t.flow_type === 'in')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  if (loading) return <div className="p-8 text-center">Đang tải dữ liệu tài chính...</div>;

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Tài chính & Quỹ CLB</h1>

      {/* TABS SWITCHER */}
      <div className="flex p-1 bg-gray-100 rounded-lg w-fit">
        <button
          onClick={() => { console.log('[MemberFinance] switch tab: personal'); setActiveTab('personal'); }}
          className={`px-4 py-2 rounded-md text-sm font-medium transition ${
            activeTab === 'personal' ? 'bg-white shadow text-blue-600' : 'text-gray-500'
          }`}
        >
          Của tôi
        </button>
        <button
          onClick={() => { console.log('[MemberFinance] switch tab: public'); setActiveTab('public'); }}
          className={`px-4 py-2 rounded-md text-sm font-medium transition ${
            activeTab === 'public' ? 'bg-white shadow text-blue-600' : 'text-gray-500'
          }`}
        >
          Minh bạch Quỹ CLB
        </button>
      </div>

      {activeTab === 'personal' ? (
        <div className="space-y-6">
          {/* 1. THẺ CÔNG NỢ */}
          <div className={`p-6 rounded-2xl border ${totalDebt > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Trạng thái nghĩa vụ</p>
                <div className="flex items-end gap-2">
                  <span className={`text-3xl font-bold ${totalDebt > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {totalDebt > 0 ? formatCurrency(totalDebt) : 'Hoàn thành'}
                  </span>
                  {totalDebt > 0 && <span className="text-red-500 text-sm font-medium mb-1">chưa đóng</span>}
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  {totalDebt > 0 
                    ? "Bạn có khoản cần thanh toán. Vui lòng quét QR bên dưới." 
                    : "Tuyệt vời! Bạn không có khoản nợ nào."}
                </p>
              </div>
              <div className={`p-3 rounded-full ${totalDebt > 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                {totalDebt > 0 ? <AlertCircle size={24} /> : <CheckCircle2 size={24} />}
              </div>
            </div>
            
            {totalDebt > 0 && (
              <button className="mt-4 w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 rounded-lg transition shadow-sm flex items-center justify-center gap-2">
                <CreditCard size={18} /> Thanh toán ngay (QR Code)
              </button>
            )}
          </div>

          {/* 2. LỊCH SỬ GIAO DỊCH */}
          <div>
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <History size={20} /> Lịch sử giao dịch (Năm nay)
            </h3>
            <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
              {myTrans.length === 0 ? (
                <p className="p-4 text-gray-500 text-center">Chưa có giao dịch nào.</p>
              ) : (
                <div className="divide-y">
                  {myTrans.map((t) => (
                    <div key={t.transaction_id} className="p-4 flex justify-between items-center hover:bg-gray-50">
                      <div>
                        <p className="font-medium text-gray-800">{t.description || t.category_name}</p>
                        <p className="text-xs text-gray-500">{formatDate(t.created_at)} • {t.category_name}</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-medium ${t.flow_type === 'in' ? 'text-red-600' : 'text-green-600'}`}>
                          {t.flow_type === 'in' ? '-' : '+'}{formatCurrency(t.amount)}
                        </p>

                        {/* LOGIC MỚI: Xử lý màu sắc và Chữ hiển thị */}
                        <span className={`inline-block px-2 py-0.5 text-[10px] rounded-full uppercase font-bold mt-1 ${
                          t.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 
                          t.payment_status === 'cancelled' ? 'bg-gray-100 text-gray-500' : 
                          // Nếu là Pending: IN thì màu đỏ (cảnh báo nợ), OUT thì màu cam/xanh (đang chờ nhận)
                          (t.flow_type === 'in' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700')
                        }`}>
                          {t.payment_status === 'pending' 
                            ? (t.flow_type === 'in' ? 'Chờ đóng' : 'Chờ trao') // <--- ĐÂY LÀ CHỖ BẠN CẦN
                            : (t.payment_status === 'paid' ? 'Hoàn thành' : 'Đã hủy')
                          }
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* 1. DASHBOARD QUỸ CHUNG */}
          {/* 2. CẬP NHẬT DASHBOARD QUỸ CHUNG (4 CỘT) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Đầu kỳ */}
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
              <p className="text-xs text-gray-500 font-medium uppercase">Số dư đầu năm</p>
              <p className="text-xl font-bold text-gray-700 mt-1">
                {formatCurrency(openingBalance ?? 0)}
              </p>
            </div>

            {/* Card 2: Thu mới */}
            <div className="p-4 bg-white border border-green-100 rounded-xl">
              <p className="text-xs text-green-600 font-medium uppercase">Thu mới (Năm nay)</p>
              <p className="text-xl font-bold text-green-600 mt-1">
                +{formatCurrency(totalIncomeReal ?? 0)}
              </p>
            </div>

            {/* Card 3: Chi tiêu */}
            <div className="p-4 bg-white border border-orange-100 rounded-xl">
              <p className="text-xs text-orange-600 font-medium uppercase">Đã chi (Năm nay)</p>
              <p className="text-xl font-bold text-orange-600 mt-1">
                -{formatCurrency(totalExpense ?? 0)}
              </p>
            </div>

            {/* Card 4: Tồn quỹ */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl shadow-sm">
              <p className="text-xs text-blue-700 font-medium uppercase">Tồn quỹ hiện tại</p>
              <p className="text-2xl font-bold text-blue-800 mt-1">
                {formatCurrency(clubBalance ?? 0)}
              </p>
            </div>
          </div>

          {/* 2. DANH SÁCH CHI TIÊU CÔNG KHAI */}
          <div>
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <TrendingUp size={20} /> Hoạt động chi tiêu gần đây
            </h3>
            <div className="overflow-hidden border rounded-xl shadow-sm">
              {publicExpenses.length === 0 ? (
                <div className="p-6 text-center text-gray-500">Chưa có hoạt động chi tiêu gần đây.</div>
              ) : (
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-500 border-b">
                    <tr>
                      <th className="p-3 font-medium">Ngày</th>
                      <th className="p-3 font-medium">Hạng mục</th>
                      <th className="p-3 font-medium">Nội dung chi</th>
                      <th className="p-3 font-medium text-right">Số tiền</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y bg-white">
                    {publicExpenses.map((e, idx) => (
                      <tr key={`${e.payment_date}-${e.amount}-${idx}`} className="hover:bg-gray-50">
                        <td className="p-3 text-gray-500">{formatDate(e.payment_date)}</td>
                        <td className="p-3">
                          <span className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-600">
                            {e.category_name}
                          </span>
                        </td>
                        <td className="p-3 text-gray-800">{e.description}</td>
                        <td className="p-3 text-right font-medium text-orange-600">
                          -{formatCurrency(e.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
  
}
