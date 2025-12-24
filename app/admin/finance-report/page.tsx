'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getEffectiveRole } from '@/lib/auth/role';
import { formatCurrency } from '@/lib/utils';
// Use server API endpoints instead of financeService
import { ArrowLeft, PieChart } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/AuthContext';

interface CategoryReportItem {
  category_id: string;
  category_name: string;
  flow_type: 'in' | 'out';
  total_amount: number;
  transaction_count: number;
}

export default function FinanceReportPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [reportData, setReportData] = useState<CategoryReportItem[]>([]);
  const [clubBalance, setClubBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { user, isLoading: authLoading, sessionChecked } = useAuth();
  
  // Danh sách năm (5 năm gần nhất)
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 1 + i);

  // Kiểm tra vai trò người dùng (dựa vào session) trước khi tải báo cáo
  const checkRole = useCallback(() => {
    if (!user) {
      router.push('/debug-login');
      return;
    }

    const userRole = getEffectiveRole(user);
    if (!userRole || !["admin", "mod_finance", "mod_challenge", "mod_member"].includes(userRole)) {
      router.push('/');
    }
  }, [user, router]);

  useEffect(() => {
    if (authLoading || !sessionChecked) return;
    checkRole();
  }, [authLoading, sessionChecked, checkRole]);

  // Load báo cáo khi session đã checked (role check will redirect if unauthorized)
  useEffect(() => {
    if (authLoading || !sessionChecked) return;
    async function loadReport() {
      setLoading(true);
      try {
        // Fetch report rows from server endpoint
        const rep = await fetch(`/api/finance/report?year=${encodeURIComponent(String(year))}`, { credentials: 'include' });
        if (!rep.ok) throw new Error(`report fetch failed ${rep.status}`);
        const repBody = await rep.json();
        if (!repBody?.ok) throw new Error(repBody?.error ?? 'report error');
        setReportData((repBody.data ?? []) as CategoryReportItem[]);

        // Fetch totals (includes clubBalance)
        try {
          const tot = await fetch(`/api/finance/totals?year=${encodeURIComponent(String(year))}`, { credentials: 'include' });
          if (!tot.ok) throw new Error(`totals fetch failed ${tot.status}`);
          const totBody = await tot.json();
          setClubBalance(Number(totBody?.totals?.clubBalance ?? 0));
        } catch (err) {
          console.error('Lỗi tải số dư quỹ:', err);
        }
      } catch (error) {
        console.error('Lỗi tải báo cáo:', error);
      } finally {
        setLoading(false);
      }
    }
    loadReport();
  }, [year, authLoading, sessionChecked]);

  const incomeData = reportData.filter(i => i.flow_type === 'in');
  const expenseData = reportData.filter(i => i.flow_type === 'out');

  const totalIncome = incomeData.reduce((sum, i) => sum + i.total_amount, 0);
  const totalExpense = expenseData.reduce((sum, i) => sum + i.total_amount, 0);

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <Link href="/admin/finance" className="flex items-center text-gray-500 hover:text-gray-800 mb-2 transition">
            <ArrowLeft size={18} className="mr-1" /> Quay lại Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <PieChart className="text-blue-600" /> Báo cáo Tài chính Chi tiết
          </h1>
        </div>
        
        {/* YEAR SELECTOR */}
        <div className="flex items-center gap-2 bg-white border p-1 rounded-lg shadow-sm">
          <span className="pl-3 text-sm text-gray-500 font-medium">Năm tài chính:</span>
          <select 
            value={year} 
            onChange={(e) => setYear(Number(e.target.value))}
            className="p-2 bg-transparent font-bold text-gray-800 outline-none cursor-pointer"
          >
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {authLoading || !sessionChecked ? (
        <div className="text-center py-10">Đang kiểm tra quyền truy cập...</div>
      ) : loading ? (
        <div className="text-center py-10">Đang tính toán số liệu...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border p-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold">Số dư hiện tại</h3>
                <p className="text-sm text-gray-500">Số dư quỹ của câu lạc bộ</p>
              </div>
              <div className={`text-2xl font-bold ${clubBalance !== null ? (clubBalance > 0 ? 'text-green-600' : clubBalance < 0 ? 'text-red-600' : 'text-gray-700') : 'text-gray-700'}`}>
                {formatCurrency(clubBalance ?? 0)}
              </div>
            </div>
          </div>
          
          <ReportSection 
            title="NGUỒN THU (INCOME)" 
            total={totalIncome} 
            data={incomeData} 
            colorClass="bg-green-500" 
            headerClass="bg-green-50 text-green-800 border-green-100"
          />

          <ReportSection 
            title="KHOẢN CHI (EXPENSE)" 
            total={totalExpense} 
            data={expenseData} 
            colorClass="bg-orange-500" 
            headerClass="bg-orange-50 text-orange-800 border-orange-100"
          />

        </div>
      )}
    </div>
  );
}

// --- SUB COMPONENTS ---
const ReportSection = ({ 
  title, 
  total, 
  data, 
  colorClass, 
  headerClass 
}: { 
  title: string, 
  total: number, 
  data: CategoryReportItem[], 
  colorClass: string,
  headerClass: string 
}) => {
  return (
    <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
      <div className={`p-4 border-b flex justify-between items-center ${headerClass}`}>
        <h3 className="font-bold">{title}</h3>
        <span className="text-xl font-bold">{formatCurrency(total)}</span>
      </div>
      
      <div className="p-4 space-y-6">
        {data.length === 0 ? (
          <p className="text-gray-400 text-sm text-center italic py-4">Chưa có dữ liệu.</p>
        ) : (
          data.map((item, idx) => {
            const percent = total > 0 ? (item.total_amount / total) * 100 : 0;
            
            return (
              <div key={`${item.category_id}-${idx}`}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-gray-700">{item.category_name}</span>
                  <div className="text-right">
                    <span className="font-bold">{formatCurrency(item.total_amount)}</span>
                    <span className="text-gray-400 text-xs ml-2">({item.transaction_count} gd)</span>
                  </div>
                </div>
                
                <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                  <div 
                    className={`h-2.5 rounded-full ${colorClass}`} 
                    style={{ width: `${percent}%` }}
                  ></div>
                </div>
                <p className="text-xs text-right text-gray-400 mt-1">{percent.toFixed(1)}%</p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};