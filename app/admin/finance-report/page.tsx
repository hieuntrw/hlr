"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase-client";

interface TransactionSummary {
  type: string;
  total: number;
  count: number;
}

function formatCash(amount: number): string {
  return amount.toLocaleString("vi-VN") + " ₫";
}

export default function FinanceReportPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<TransactionSummary[]>([]);
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpense, setTotalExpense] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkRole();
    fetchReport();
  }, []);

  async function checkRole() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/debug-login");
      return;
    }
    const role = user.user_metadata?.role;
    if (!role || !["admin", "mod_finance"].includes(role)) {
      router.push("/");
    }
  }

  async function fetchReport() {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("transactions")
        .select("type, amount");

      if (error) {
        console.error("Error:", error);
        return;
      }

      const grouped: { [key: string]: { total: number; count: number } } = {};

      (data || []).forEach((t) => {
        if (!grouped[t.type]) {
          grouped[t.type] = { total: 0, count: 0 };
        }
        grouped[t.type].total += t.amount;
        grouped[t.type].count += 1;
      });

      const summaryArray = Object.entries(grouped).map(([type, data]) => ({
        type,
        total: data.total,
        count: data.count,
      }));

      setSummary(summaryArray);

      const income = summaryArray
        .filter((s) => ["fund_collection", "donation"].includes(s.type))
        .reduce((sum, s) => sum + s.total, 0);

      const expense = summaryArray
        .filter((s) => ["expense", "fine", "reward_payout"].includes(s.type))
        .reduce((sum, s) => sum + s.total, 0);

      setTotalIncome(income);
      setTotalExpense(expense);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  }

  const balance = totalIncome - totalExpense;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600 to-orange-700 text-white py-6 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">📊 Báo Cáo Quỹ</h1>
            <Link href="/admin" className="text-blue-100 hover:text-white">
              ← Quay lại
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Đang tải báo cáo...</p>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white rounded-lg shadow-md p-6">
                <p className="text-gray-600 text-sm">Thu Nhập</p>
                <p className="text-2xl font-bold text-green-600 mt-2">{formatCash(totalIncome)}</p>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <p className="text-gray-600 text-sm">Chi Tiêu</p>
                <p className="text-2xl font-bold text-red-600 mt-2">{formatCash(totalExpense)}</p>
              </div>

              <div
                className={`rounded-lg shadow-md p-6 ${
                  balance >= 0 ? "bg-green-50" : "bg-red-50"
                }`}
              >
                <p className={`text-sm ${balance >= 0 ? "text-green-600" : "text-red-600"}`}>
                  Số Dư
                </p>
                <p
                  className={`text-2xl font-bold mt-2 ${
                    balance >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {formatCash(balance)}
                </p>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <p className="text-gray-600 text-sm">Tổng Giao Dịch</p>
                <p className="text-2xl font-bold text-orange-600 mt-2">
                  {summary.reduce((sum, s) => sum + s.count, 0)}
                </p>
              </div>
            </div>

            {/* Breakdown */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-bold mb-4">Chi Tiết Theo Loại</h2>

              <div className="space-y-4">
                {summary.map((item) => {
                  const typeLabels: { [key: string]: string } = {
                    fund_collection: "Thu Quỹ",
                    fine: "Phạt",
                    donation: "Quyên Góp",
                    expense: "Chi Tiêu",
                    reward_payout: "Thưởng",
                  };

                  const percentage =
                    (totalIncome + totalExpense) > 0
                      ? ((item.total / (totalIncome + totalExpense)) * 100).toFixed(1)
                      : "0";

                  return (
                    <div key={item.type} className="border-b border-gray-200 pb-4 last:border-0">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-gray-900">
                          {typeLabels[item.type] || item.type}
                        </span>
                        <div className="text-right">
                          <p className="font-bold text-gray-900">{formatCash(item.total)}</p>
                          <p className="text-sm text-gray-600">{item.count} giao dịch</p>
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-orange-600 h-2 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">{percentage}% của tổng</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
