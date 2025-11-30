import { supabase } from "@/lib/supabase-client";
import type { SupabaseClient } from '@supabase/supabase-js';

async function getSystemSetting(key: string) {
  const { data, error } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", key)
    .single();

  if (error) {
    throw new Error(`Failed to load system setting ${key}: ${error.message}`);
  }

  return data?.value ?? null;
}

/**
 * Create monthly fund transactions for all active members.
 * Creates one 'fund_collection' transaction per active user for the current month.
 */
export async function generateMonthlyFund() {
  // Read amount from system settings (fallback 50000)
  const feeVal = await getSystemSetting("monthly_fund_fee");
  const amount = Number(feeVal ?? 50000);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12

  // transaction_date use first day of month
  const transactionDate = new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 10);

  // Get all active members
  const { data: members, error: membersError } = await supabase
    .from("profiles")
    .select("id")
    .eq("is_active", true);

  if (membersError) {
    throw new Error(`Failed to fetch active members: ${membersError.message}`);
  }

  if (!Array.isArray(members) || members.length === 0) return { created: 0 };

  // For each member, avoid duplicates for same month/type
  const inserts: any[] = [];

  for (const m of members) {
    const userId = m.id;

    // Check existing transaction for this user, type and month
    const { data: existing } = await supabase
      .from("transactions")
      .select("id")
      .eq("user_id", userId)
      .eq("type", "fund_collection")
      .eq("transaction_date", transactionDate)
      .limit(1)
      .maybeSingle();

    if (existing) continue; // skip if already exists

    inserts.push({
      user_id: userId,
      type: "fund_collection",
      amount,
      description: `Monthly fund ${year}-${String(month).padStart(2, "0")}`,
      transaction_date: transactionDate,
      payment_status: "pending",
      created_at: new Date().toISOString(),
    });
  }

  if (inserts.length === 0) return { created: 0 };

  const { error: insertError } = await supabase.from("transactions").insert(inserts);

  if (insertError) {
    throw new Error(`Failed to create monthly fund transactions: ${insertError.message}`);
  }

  return { created: inserts.length };
}

/**
 * Process fines for a challenge:
 * - For participants with status 'failed' -> create a 'fine' transaction
 * - For active members who are NOT registered in the challenge -> create a 'fine' transaction
 * Transactions created will have payment_status = 'pending'
 */
export async function processChallengeFines(challengeId: string) {
  if (!challengeId) throw new Error("challengeId is required");

  const fineVal = await getSystemSetting("challenge_fine_fee");
  const amount = Number(fineVal ?? 100000);

  // Fetch participants for the challenge
  const { data: participants, error: partError } = await supabase
    .from("challenge_participants")
    .select("user_id, status")
    .eq("challenge_id", challengeId);

  if (partError) {
    throw new Error(`Failed to fetch participants: ${partError.message}`);
  }

  const failedUsers = new Set<string>();
  if (Array.isArray(participants)) {
    for (const p of participants) {
      if (p.status === "failed") failedUsers.add(p.user_id);
    }
  }

  // Fetch all active members
  const { data: members, error: membersError } = await supabase
    .from("profiles")
    .select("id")
    .eq("is_active", true);

  if (membersError) {
    throw new Error(`Failed to fetch members: ${membersError.message}`);
  }

  const participantUserIds = Array.isArray(participants)
    ? participants.map((p: any) => p.user_id)
    : [];

  const notRegisteredUsers: string[] = [];
  if (Array.isArray(members)) {
    for (const m of members) {
      if (!participantUserIds.includes(m.id)) notRegisteredUsers.push(m.id);
    }
  }

  // Consolidate users to fine: union of failedUsers + notRegisteredUsers
  const toFine = new Set<string>([...failedUsers, ...notRegisteredUsers]);

  if (toFine.size === 0) return { finesCreated: 0 };

  const inserts: any[] = [];

  // Use related_challenge_id to mark which challenge
  for (const userId of Array.from(toFine)) {
    // Avoid duplicate fine for same user/challenge
    const { data: existing } = await supabase
      .from("transactions")
      .select("id")
      .eq("user_id", userId)
      .eq("type", "fine")
      .eq("related_challenge_id", challengeId)
      .limit(1)
      .maybeSingle();

    if (existing) continue;

    inserts.push({
      user_id: userId,
      type: "fine",
      amount,
      description: `Challenge fine for ${challengeId}`,
      transaction_date: new Date().toISOString().slice(0, 10),
      payment_status: "pending",
      related_challenge_id: challengeId,
      created_at: new Date().toISOString(),
    });
  }

  if (inserts.length === 0) return { finesCreated: 0 };

  const { error: insertError } = await supabase.from("transactions").insert(inserts);

  if (insertError) {
    throw new Error(`Failed to create fine transactions: ${insertError.message}`);
  }

  return { finesCreated: inserts.length };
}

export default {
  generateMonthlyFund,
  processChallengeFines,
};

// Client-friendly helpers ---------------------------------------------------

export async function fetchUserTransactionsClient(supabaseClient: SupabaseClient, userId: string) {
  try {
    const { data, error } = await supabaseClient
      .from('transactions')
      .select('id, created_at, type, description, amount, payment_status, receipt_url')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) {
      console.error('fetchUserTransactionsClient error', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('fetchUserTransactionsClient exception', err);
    return [];
  }
}

export async function fetchPublicFundStatsClient(supabaseClient: SupabaseClient) {
  try {
    // Try RPC first
    try {
      const { data: rpcData, error: rpcErr } = await supabaseClient.rpc('compute_public_fund_balance');
      if (!rpcErr && rpcData) {
        let balance = 0;
        if (typeof rpcData === 'number') balance = rpcData;
        else if (Array.isArray(rpcData) && rpcData[0] && rpcData[0].balance) balance = Number(rpcData[0].balance);
        else if ((rpcData as any).balance) balance = Number((rpcData as any).balance);

        const { data: recentExp } = await supabaseClient
          .from('transactions')
          .select('id, created_at, type, description, amount, user_id')
          .in('type', ['expense', 'reward_payout', 'fine', 'purchase'])
          .order('created_at', { ascending: false })
          .limit(10);

        return { balance, recentExpenses: recentExp || [] };
      }
    } catch (e) {
      // fallback
    }

    const { data: creditRows } = await supabaseClient
      .from('transactions')
      .select('amount, type')
      .in('type', ['fund_collection', 'donation'])
      .limit(10000);
    const credits = (creditRows || []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);

    const { data: expenseRows } = await supabaseClient
      .from('transactions')
      .select('amount, type, description, created_at, user_id')
      .in('type', ['expense', 'reward_payout', 'fine', 'purchase'])
      .order('created_at', { ascending: false })
      .limit(10000);
    const expenses = (expenseRows || []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);

    const { data: recentExpenses } = await supabaseClient
      .from('transactions')
      .select('id, created_at, type, description, amount, user_id')
      .in('type', ['expense', 'reward_payout', 'fine', 'purchase'])
      .order('created_at', { ascending: false })
      .limit(10);

    return { balance: credits - expenses, recentExpenses: recentExpenses || [] };
  } catch (err) {
    console.error('fetchPublicFundStatsClient exception', err);
    return { balance: 0, recentExpenses: [] };
  }
}

export async function uploadReceiptForTransactionClient(
  supabaseClient: SupabaseClient,
  transactionId: string,
  file: File,
  userId: string
) {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `receipts/${year}/${month}/${transactionId}_${safeName}`;

    const { data: uploadData, error: uploadError } = await supabaseClient.storage
      .from('receipts')
      .upload(path, file, { cacheControl: '3600', upsert: false });

    if (uploadError) {
      console.error('uploadReceipt error', uploadError);
      return { error: uploadError };
    }

    const { data: urlData } = supabaseClient.storage.from('receipts').getPublicUrl(path);
    const publicUrl = urlData?.publicUrl || null;

    const { data: txData, error: txError } = await supabaseClient
      .from('transactions')
      .update({ receipt_url: publicUrl, payment_status: 'submitted', receipt_uploaded_by: userId, receipt_uploaded_at: new Date().toISOString() })
      .eq('id', transactionId)
      .select()
      .single();

    if (txError) {
      console.error('update transaction with receipt error', txError);
      return { error: txError };
    }

    return { ok: true, transaction: txData };
  } catch (err) {
    console.error('uploadReceiptForTransactionClient exception', err);
    return { error: err };
  }
}
