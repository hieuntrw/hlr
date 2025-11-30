"use client";

import { useState, useEffect } from "react";
import RejectModal from "./RejectModal";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase-client";

interface Transaction {
  id: string;
  user_id?: string;
  type: string;
  amount: number;
  description: string;
  transaction_date: string;
  payment_status: string;
  profile?: {
    full_name: string;
  };
  receipt_url?: string | null;
  paid_by?: string | null;
  paid_at?: string | null;
  rejected_by?: string | null;
  rejected_at?: string | null;
  rejection_reason?: string | null;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatCash(amount: number): string {
  return amount.toLocaleString("vi-VN") + " ₫";
}

function getTypeColor(type: string): string {
  const colors: { [key: string]: string } = {
    fund_collection: "bg-blue-100 text-blue-800",
    fine: "bg-red-100 text-red-800",
    donation: "bg-green-100 text-green-800",
    expense: "bg-orange-100 text-orange-800",
    reward_payout: "bg-purple-100 text-purple-800",
  };
  return colors[type] || "bg-gray-100 text-gray-800";
}

function getTypeLabel(type: string): string {
  const labels: { [key: string]: string } = {
    fund_collection: "Thu Quỹ",
    fine: "Phạt",
    donation: "Quyên Góp",
    expense: "Chi Tiêu",
    reward_payout: "Thưởng",
  };
  return labels[type] || type;
}

export default function FinancePage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [adminUserId, setAdminUserId] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);

  useEffect(() => {
    checkRole();
    fetchTransactions();
  }, []);

  async function checkRole() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/debug-login");
      return;
    }

    setAdminUserId(user.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role && ["admin", "mod_finance"].includes(profile.role)) {
      setRole(profile.role);
    } else {
      router.push("/");
    }
  }

  async function fetchTransactions() {
    setLoading(true);

    try {
      let query = supabase
        .from("transactions")
        .select("id, user_id, type, amount, description, transaction_date, payment_status, profiles(full_name), receipt_url, paid_by, paid_at, rejected_by, rejected_at, rejection_reason")
        .order("transaction_date", { ascending: false });

      if (filterType) {
        query = query.eq("type", filterType);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching transactions:", error);
        return;
      }

          setTransactions(
            data?.map((t: any) => ({
              id: t.id,
              user_id: t.user_id,
              type: t.type,
              amount: t.amount,
              description: t.description,
              transaction_date: t.transaction_date,
              payment_status: t.payment_status,
              profile: t.profiles,
              receipt_url: t.receipt_url,
              paid_by: t.paid_by,
              paid_at: t.paid_at,
              rejected_by: t.rejected_by,
              rejected_at: t.rejected_at,
              rejection_reason: t.rejection_reason,
            })) || []
          );
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function approveTransaction(transactionId: string) {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .update({ payment_status: 'paid', paid_by: adminUserId, paid_at: new Date().toISOString() })
        .eq('id', transactionId)
        .select()
        .single();
      if (error) throw error;
      alert('Đã xác nhận thanh toán.');
      fetchTransactions();
    } catch (err) {
      console.error(err);
      alert('Không thể xác nhận.');
    }
  }

  async function rejectTransaction(transactionId: string, reason: string) {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .update({ payment_status: 'rejected', rejected_by: adminUserId, rejected_at: new Date().toISOString(), rejection_reason: reason })
        .eq('id', transactionId)
        .select()
        .single();
      if (error) throw error;
      alert('Đã từ chối biên lai.');
      fetchTransactions();
    } catch (err) {
      console.error(err);
      alert('Không thể từ chối.');
    }
  }

  useEffect(() => {
    fetchTransactions();
  }, [filterType]);

  const totalIncome = transactions
    .filter((t) => ["fund_collection", "donation"].includes(t.type))
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = transactions
    .filter((t) => ["expense", "fine", "reward_payout"].includes(t.type))
    .reduce((sum, t) => sum + t.amount, 0);

  const balance = totalIncome - totalExpense;

  if (!role) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Đang kiểm tra quyền...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-6 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold">💰 Quản Lý Thu/Chi</h1>
            <Link href="/admin" className="text-blue-100 hover:text-white">
              ← Quay lại
            </Link>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/20 rounded-lg p-4">
              <p className="text-blue-100">Thu Nhập</p>
              <p className="text-2xl font-bold">{formatCash(totalIncome)}</p>
            </div>
            <div className="bg-white/20 rounded-lg p-4">
              <p className="text-blue-100">Chi Tiêu</p>
              <p className="text-2xl font-bold">{formatCash(totalExpense)}</p>
            </div>
            <div className={`${balance >= 0 ? "bg-green-500/20" : "bg-red-500/20"} rounded-lg p-4`}>
              <p className="text-white/80">Số Dư</p>
              <p className="text-2xl font-bold">{formatCash(balance)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Filter */}
        <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setFilterType(null)}
            className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-colors ${
              filterType === null
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 hover:bg-gray-100"
            }`}
          >
            Tất Cả
          </button>
          <button
            onClick={() => setFilterType("fund_collection")}
            className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-colors ${
              filterType === "fund_collection"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 hover:bg-gray-100"
            }`}
          >
            Thu Quỹ
          </button>
          <button
            onClick={() => setFilterType("fine")}
            className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-colors ${
              filterType === "fine"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 hover:bg-gray-100"
            }`}
          >
            Phạt
          </button>
          <button
            onClick={() => setFilterType("expense")}
            className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-colors ${
              filterType === "expense"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 hover:bg-gray-100"
            }`}
          >
            Chi Tiêu
          </button>
          <button
            onClick={() => setFilterType("reward_payout")}
            className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-colors ${
              filterType === "reward_payout"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 hover:bg-gray-100"
            }`}
          >
            Thưởng
          </button>
        </div>

        {/* Transactions Table */}
        <div className="bg-white rounded-lg shadow-md overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center">
              <p className="text-gray-600">Đang tải dữ liệu...</p>
            </div>
          ) : transactions.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-300 bg-gray-50">
                  <th className="text-left py-3 px-4 font-bold text-gray-700">Ngày</th>
                  <th className="text-left py-3 px-4 font-bold text-gray-700">Loại</th>
                  <th className="text-left py-3 px-4 font-bold text-gray-700">Thành Viên</th>
                  <th className="text-left py-3 px-4 font-bold text-gray-700">Mô Tả</th>
                  <th className="text-right py-3 px-4 font-bold text-gray-700">Số Tiền</th>
                  <th className="text-center py-3 px-4 font-bold text-gray-700">Trạng Thái</th>
                  <th className="text-center py-3 px-4 font-bold text-gray-700">Hành Động</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr key={transaction.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="py-3 px-4">{formatDate(transaction.transaction_date)}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${getTypeColor(
                          transaction.type
                        )}`}
                      >
                        {getTypeLabel(transaction.type)}
                      </span>
                    </td>
                    <td className="py-3 px-4">{transaction.profile?.full_name || "---"}</td>
                    <td className="py-3 px-4">{transaction.description}</td>
                    <td className="py-3 px-4 text-right font-bold">
                      {["expense", "fine", "reward_payout"].includes(transaction.type) ? "-" : "+"}
                      {formatCash(transaction.amount)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex px-2 py-1 rounded text-xs font-semibold ${
                          transaction.payment_status === "paid"
                            ? "bg-green-100 text-green-800"
                            : transaction.payment_status === "rejected"
                            ? "bg-red-100 text-red-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {transaction.payment_status === "paid"
                          ? "✓ Đã thanh toán"
                          : transaction.payment_status === "rejected"
                          ? "Đã từ chối"
                          : "⏳ Chờ"}
                      </span>
                      {transaction.payment_status === "rejected" && transaction.rejection_reason && (
                        <div className="text-xs text-red-600 mt-1">Lý do: {transaction.rejection_reason}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {transaction.payment_status === 'submitted' ? (
                        <div className="flex items-center justify-center gap-2">
                          {transaction['receipt_url'] && (
                            <a href={transaction['receipt_url']} target="_blank" rel="noreferrer" className="text-sm underline text-sky-600">Xem biên lai</a>
                          )}
                          <button onClick={() => approveTransaction(transaction.id)} className="px-3 py-1 bg-green-600 text-white rounded text-sm">Xác nhận</button>
                          <button onClick={() => { setRejectingId(transaction.id); setShowRejectModal(true); }} className="px-3 py-1 bg-red-600 text-white rounded text-sm">Từ chối</button>
                              <RejectModal
                                open={showRejectModal}
                                onClose={() => setShowRejectModal(false)}
                                onSubmit={reason => {
                                  if (rejectingId) rejectTransaction(rejectingId, reason);
                                  setShowRejectModal(false);
                                  setRejectingId(null);
                                }}
                              />
                        </div>
                      ) : (
                        <span className="text-sm text-gray-600">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center">
              <p className="text-gray-500">Không có giao dịch nào</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
