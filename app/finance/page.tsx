"use client";

import React, { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

// Mobile-first personal finance page for members
export default function FinancePage() {
  const supabase = createClientComponentClient();
  const [user, setUser] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [pendingTotal, setPendingTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [showPayModal, setShowPayModal] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'personal'|'report'>('personal');
  const [publicFund, setPublicFund] = useState<{ balance: number, recentExpenses: any[] }>({ balance: 0, recentExpenses: [] });

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      const u = userData?.user || null;
      setUser(u);
      if (u) {
        const trs = await getUserTransactions(u.id);
        setTransactions(trs);
        const pending = trs
          .filter(t => (t.payment_status === 'pending' || t.payment_status === 'Chưa nộp' || t.payment_status === 'pending' ))
          .reduce((s, t) => s + Number(t.amount || 0), 0);
        setPendingTotal(pending);
      }
      const stats = await getPublicFundStats();
      setPublicFund(stats);
      setLoading(false);
    })();
  }, []);

  async function getUserTransactions(userId: string) {
    // Returns array of transactions for the user, latest first
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('id, created_at, type, description, amount, payment_status')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) {
        console.error('getUserTransactions error', error);
        return [];
      }
      return data || [];
    } catch (err) {
      console.error(err);
      return [];
    }
  }

  async function getPublicFundStats() {
    // Compute fund balance and recent 10 expense-type transactions for transparency
    try {
      // Balance: we assume transactions with type 'fund_collection' and 'donation' are credits,
      // expenses are 'expense', 'reward_payout', 'purchase' or 'fine' (depends on naming). Adjust as needed.
      const { data: balanceData, error: balanceError } = await supabase
        .rpc('compute_public_fund_balance')
        .limit?.(1);

      // If the DB doesn't have the RPC, gracefully fallback to calculating here
      let balance = 0;
      if (!balanceError && balanceData) {
        // If RPC returns numeric or object
        if (typeof balanceData === 'number') balance = balanceData;
        else if (balanceData && balanceData[0] && balanceData[0].balance) balance = Number(balanceData[0].balance);
      } else {
        // Fallback: sum credits - sum expenses
        const { data: creditRows } = await supabase
          .from('transactions')
          .select('amount, type, user_id')
          .in('type', ['fund_collection', 'donation'])
          .limit(10000);
        const credits = (creditRows || [])
          .filter(r => r.amount)
          .reduce((s, r) => s + Number(r.amount), 0);

        const { data: expenseRows } = await supabase
          .from('transactions')
          .select('amount, type, user_id, description, created_at')
          .in('type', ['expense', 'reward_payout', 'fine', 'purchase'])
          .limit(10000);
        const expenses = (expenseRows || [])
          .filter(r => r.amount)
          .reduce((s, r) => s + Number(r.amount), 0);

        balance = credits - expenses;
      }

      // Recent expenses (exclude user-specific fund_collections/donations): show latest 10 transactions of expense types
      const { data: recentExp } = await supabase
        .from('transactions')
        .select('id, created_at, type, description, amount, user_id')
        .in('type', ['expense', 'reward_payout', 'fine', 'purchase'])
        .order('created_at', { ascending: false })
        .limit(10);

      const recentExpenses = (recentExp || []).map((r: any) => ({
        id: r.id,
        created_at: r.created_at,
        type: r.type,
        description: r.description,
        amount: Number(r.amount || 0),
        user_id: r.user_id
      }));

      return { balance, recentExpenses };
    } catch (err) {
      console.error('getPublicFundStats', err);
      return { balance: 0, recentExpenses: [] };
    }
  }

  function formatCurrency(v: number) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v);
  }

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse h-6 bg-slate-200 rounded w-3/4 mb-4" />
        <div className="animate-pulse h-40 bg-slate-200 rounded" />
      </div>
    );
  }

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Tài chính cá nhân</h1>

      {/* Personal Summary Card */}
      <section className="mb-6">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">Số tiền cần thanh toán</div>
              <div className="mt-1 text-lg font-medium">
                {pendingTotal > 0 ? (
                  <span className="text-red-600">{formatCurrency(pendingTotal)}</span>
                ) : (
                  <span className="text-green-600">Bạn đã hoàn thành nghĩa vụ tài chính</span>
                )}
              </div>
            </div>
            {pendingTotal > 0 && (
              <div>
                <button
                  className="bg-red-600 text-white px-3 py-2 rounded-md text-sm"
                  onClick={() => setShowPayModal(true)}
                >
                  Thanh toán ngay
                </button>
              </div>
            )}
          </div>
          <div className="mt-3 text-xs text-gray-500">Số dư hiển thị tính theo các khoản có trạng thái "Chưa nộp".</div>
        </div>
      </section>

      {/* Tabs */}
      <div className="mb-4">
        <div className="flex gap-2">
          <button
            className={`px-3 py-2 rounded-md text-sm ${activeTab === 'personal' ? 'bg-slate-800 text-white' : 'bg-white text-slate-700 shadow-sm'}`}
            onClick={() => setActiveTab('personal')}
          >
            Lịch sử giao dịch
          </button>
          <button
            className={`px-3 py-2 rounded-md text-sm ${activeTab === 'report' ? 'bg-slate-800 text-white' : 'bg-white text-slate-700 shadow-sm'}`}
            onClick={() => setActiveTab('report')}
          >
            Báo cáo Quỹ CLB
          </button>
        </div>
      </div>

      {activeTab === 'personal' && (
        <section>
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="w-full overflow-x-auto">
              <table className="min-w-full divide-y">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Ngày</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Loại</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Nội dung</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Số tiền</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y">
                  {transactions.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">Không có giao dịch</td>
                    </tr>
                  )}
                  {transactions.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-600">{new Date(t.created_at).toLocaleString('vi-VN')}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 capitalize">{t.type}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{t.description}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-800">{formatCurrency(Number(t.amount || 0))}</td>
                      <td className="px-4 py-3 text-sm text-center">
                        {t.payment_status === 'paid' || t.payment_status === 'Đã nộp' ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">Đã nộp</span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-red-100 text-red-800">Chưa nộp</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'report' && (
        <section>
          <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500">Tổng Quỹ hiện tại</div>
                <div className="mt-1 text-xl font-semibold">{formatCurrency(publicFund.balance)}</div>
              </div>
              <div className="text-sm text-gray-500">Minh bạch & cập nhật</div>
            </div>
            <div className="mt-2 text-xs text-gray-500">Số dư tính bằng tổng thu - tổng chi ghi trong hệ thống.</div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4">
            <h3 className="text-sm font-medium mb-3">10 khoản Chi gần nhất</h3>
            {publicFund.recentExpenses.length === 0 && (
              <div className="text-sm text-gray-500">Không có khoản chi nào.</div>
            )}
            <ul className="space-y-3">
              {publicFund.recentExpenses.map((r) => (
                <li key={r.id} className="flex justify-between items-start">
                  <div>
                    <div className="text-sm font-medium">{r.description || r.type}</div>
                    <div className="text-xs text-gray-500">{new Date(r.created_at).toLocaleDateString('vi-VN')}</div>
                  </div>
                  <div className="text-sm text-right">
                    <div className="font-medium">{formatCurrency(r.amount)}</div>
                    <div className="text-xs text-gray-500">{r.type}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Payment Modal */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowPayModal(false)} />
          <div className="relative w-full sm:w-96 bg-white rounded-t-lg sm:rounded-lg shadow-lg p-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">Hướng dẫn chuyển khoản</h2>
                <div className="text-xs text-gray-500">Vui lòng chuyển đúng cú pháp để thủ quỹ dễ đối soát.</div>
              </div>
              <button className="text-slate-500" onClick={() => setShowPayModal(false)}>Đóng</button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4">
              <div className="flex items-center gap-4">
                {/* QR placeholder */}
                <div className="w-28 h-28 bg-gray-100 flex items-center justify-center rounded">
                  <svg width="80" height="80" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="3" y="3" width="7" height="7" stroke="#9CA3AF" strokeWidth="1.5" />
                    <rect x="14" y="3" width="7" height="7" stroke="#9CA3AF" strokeWidth="1.5" />
                    <rect x="3" y="14" width="7" height="7" stroke="#9CA3AF" strokeWidth="1.5" />
                    <rect x="11" y="11" width="2" height="2" fill="#9CA3AF" />
                    <rect x="14" y="14" width="2" height="2" fill="#9CA3AF" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium">Ngân hàng: Vietcombank (ví dụ)</div>
                  <div className="text-sm text-gray-600">Chủ tài khoản: HLR Running Club</div>
                  <div className="text-sm text-gray-600">Số tài khoản: 0123 456 789</div>
                </div>
              </div>

              <div className="bg-gray-50 rounded p-3 text-sm">
                <div className="text-xs text-gray-500">Cú pháp chuyển khoản (ghi rõ để đối soát):</div>
                <div className="mt-2 font-medium bg-white p-2 rounded">
                  HLR {user?.user_metadata?.full_name || user?.email || 'Tên'} [Nội dung]
                </div>
                <div className="mt-2 text-xs text-gray-500">Ví dụ: HLR Nguyễn Văn A Quỹ tháng 11/2025</div>
              </div>

              <div className="flex gap-2">
                <button className="flex-1 bg-green-600 text-white px-3 py-2 rounded" onClick={() => {
                  // For convenience copy text to clipboard (caveat: clipboard only available in browser)
                  const txt = `HLR ${user?.user_metadata?.full_name || user?.email || ''}`;
                  navigator?.clipboard?.writeText(txt).then(() => alert('Đã sao chép cú pháp chuyển khoản'));
                }}>Sao chép cú pháp</button>
                <button className="flex-1 bg-slate-100 text-slate-700 px-3 py-2 rounded" onClick={() => setShowPayModal(false)}>Đóng</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
