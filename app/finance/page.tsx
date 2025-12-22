'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { formatCurrency, formatDate } from '@/lib/utils';
import { financeService } from '@/lib/services/financeService';
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
  const supabase = createClientComponentClient();

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Load dữ liệu song song: cá nhân + các báo cáo/thu/chi/số dư từ financeService
        const year = new Date().getFullYear();
        const [
          trans,
          openingBal,
          incomeReal,
          expense,
          clubBal,
          expenses,
        ] = await Promise.all([
          financeService.getMyFinance(user.id, year),
          financeService.getOpeningBalance(year),
          financeService.getTotalIncomeReal(year),
          financeService.getTotalExpense(year),
          financeService.getClubBalance(year),
          financeService.getRecentExpenses(),
        ]);

        // Ép kiểu dữ liệu trả về từ service (nếu service trả về unknown/any)
        if (trans) setMyTrans(trans as unknown as MyTransaction[]);
        if (expenses) setPublicExpenses(expenses as unknown as PublicExpense[]);

        
         const opening = typeof openingBal === 'number' ? openingBal : Number(openingBal ?? 0);
      const club = typeof clubBal === 'number' ? clubBal : Number(clubBal ?? 0);
         const incomeNum = typeof incomeReal === 'number' ? incomeReal : Number(incomeReal ?? 0);
      const expenseNum = typeof expense === 'number' ? expense : Number(expense ?? 0);

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
  }, [supabase]); // 3. Thêm 'supabase' vào dependency array để fix lỗi eslint

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
          onClick={() => setActiveTab('personal')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition ${
            activeTab === 'personal' ? 'bg-white shadow text-blue-600' : 'text-gray-500'
          }`}
        >
          Của tôi
        </button>
        <button
          onClick={() => setActiveTab('public')}
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
                        <span className={`inline-block px-2 py-0.5 text-[10px] rounded-full uppercase font-bold ${
                          t.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 
                          t.payment_status === 'cancelled' ? 'bg-gray-100 text-gray-500' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {t.payment_status === 'pending' ? 'Chờ đóng' : t.payment_status}
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}