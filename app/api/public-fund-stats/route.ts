import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import serverDebug from '@/lib/server-debug';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    if (!url) return NextResponse.json({ ok: false, error: 'Missing SUPABASE URL' }, { status: 500 });

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    const client = serviceKey ? createClient(url, serviceKey) : createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

    // Try RPC compute_public_fund_balance first
    try {
      const { data: rpcData, error: rpcErr } = await client.rpc('compute_public_fund_balance');
      if (!rpcErr && rpcData) {
        let balance = 0;
        if (typeof rpcData === 'number') balance = rpcData;
        else if (Array.isArray(rpcData) && rpcData[0] && 'balance' in (rpcData[0] as Record<string, unknown>)) balance = Number((rpcData[0] as Record<string, unknown>).balance);
        else if (rpcData && typeof rpcData === 'object' && 'balance' in (rpcData as Record<string, unknown>)) balance = Number((rpcData as Record<string, unknown>).balance);

        const { data: recent } = await client
          .from('transactions')
          .select('id, created_at, description, amount, type')
          .in('type', ['expense', 'reward_payout', 'fine', 'purchase'])
          .order('created_at', { ascending: false })
          .limit(10);
        return NextResponse.json({ ok: true, balance, recentExpenses: recent || [] });
      }
    } catch {
      // ignore and fallback
    }

    // Fallback: compute sums
    const { data: creditRows } = await client
      .from('transactions')
      .select('amount, type')
      .in('type', ['fund_collection', 'donation']);
    const credits = (creditRows || []).reduce((s: number, r: Record<string, unknown>) => s + Number(r.amount as unknown as number || 0), 0);

    const { data: expenseRows } = await client
      .from('transactions')
      .select('amount, type')
      .in('type', ['expense', 'reward_payout', 'fine', 'purchase']);
    const expenses = (expenseRows || []).reduce((s: number, r: Record<string, unknown>) => s + Number(r.amount as unknown as number || 0), 0);

    const { data: recentExpenses } = await client
      .from('transactions')
      .select('id, created_at, description, amount, type, user_id')
      .in('type', ['expense', 'reward_payout', 'fine', 'purchase'])
      .order('created_at', { ascending: false })
      .limit(10);

    return NextResponse.json({ ok: true, balance: credits - expenses, recentExpenses: recentExpenses || [] });
  } catch (err: unknown) {
    serverDebug.error('/api/public-fund-stats exception', String(err));
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
