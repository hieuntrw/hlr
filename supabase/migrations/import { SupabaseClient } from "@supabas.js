import { SupabaseClient } from "@supabase/supabase-js";

// Lấy danh sách giao dịch của user, mới nhất lên đầu
export async function getUserTransactions(
  supabase: SupabaseClient,
  userId: string
) {
  const { data, error } = await supabase
    .from("transactions")
    .select(
      "id, transaction_date, type, description, amount, payment_status, receipt_url"
    )
    .eq("user_id", userId)
    .order("transaction_date", { ascending: false });

  if (error) throw error;
  return data || [];
}

// Lấy thống kê quỹ chung và 10 khoản chi gần nhất
export async function getPublicFundStats(supabase: SupabaseClient) {
  // Tính tổng thu - tổng chi
  const { data: income, error: errIncome } = await supabase
    .from("transactions")
    .select("amount")
    .eq("type", "fund_collection")
    .eq("payment_status", "paid");

  const { data: expense, error: errExpense } = await supabase
    .from("transactions")
    .select("amount")
    .eq("type", "expense")
    .eq("payment_status", "paid");

  if (errIncome || errExpense) throw errIncome || errExpense;

  const totalIncome =
    income?.reduce((sum, t) => sum + (t.amount || 0), 0) ?? 0;
  const totalExpense =
    expense?.reduce((sum, t) => sum + (t.amount || 0), 0) ?? 0;
  const totalBalance = totalIncome - totalExpense;

  // Lấy 10 khoản chi gần nhất
  const { data: recentExpenses, error: errRecent } = await supabase
    .from("transactions")
    .select("transaction_date, description, amount")
    .eq("type", "expense")
    .eq("payment_status", "paid")
    .order("transaction_date", { ascending: false })
    .limit(10);

  if (errRecent) throw errRecent;

  return {
    totalBalance,
    recentExpenses: recentExpenses || [],
  };
}