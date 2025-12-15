import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import serverDebug from '@/lib/server-debug';


export const dynamic = 'force-dynamic';

async function getServiceClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function ensureAdmin(supabaseAuth: SupabaseClient) {
  const { data: { user }, error } = await supabaseAuth.auth.getUser();
  if (error || !user) throw { status: 401, message: 'Không xác thực' };
  const role = (user.app_metadata as Record<string, unknown>)?.role as string | undefined;
  if (!role || !['admin','mod_finance','mod_challenge','mod_member'].includes(role)) throw { status: 403, message: 'Không có quyền' };
  return user;
}

export async function GET(request: NextRequest) {
  try {
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get(name: string) { return request.cookies.get(name)?.value }, set() {}, remove() {} } }
    );

    // Ensure caller is admin/mod
    await ensureAdmin(supabaseAuth);

    // Prefer service client for aggregate queries to bypass RLS
    const service = await getServiceClient();
    const client = service || supabaseAuth;

    // total members
    const totalMembersResp = await client.from('profiles').select('*', { count: 'exact', head: true }).eq('is_active', true);
    const totalMembers = totalMembersResp.count ?? 0;

    // active challenges
    const activeChallengesResp = await client.from('challenges').select('*', { count: 'exact', head: true }).eq('is_locked', false);
    const activeChallenges = activeChallengesResp.count ?? 0;

    // pending transactions count
    const pendingResp = await client.from('transactions').select('*', { count: 'exact', head: true }).eq('payment_status', 'pending');
    const pendingFines = pendingResp.count ?? 0;

    // fund calculation from paid transactions
    const fundDataResp = await client.from('transactions').select('amount, type').eq('payment_status', 'paid');
    let totalFund = 0;
    if (!fundDataResp.error && Array.isArray(fundDataResp.data)) {
      for (const t of fundDataResp.data) {
        if (t.type === 'fund_collection' || t.type === 'fine' || t.type === 'donation') totalFund += Number(t.amount || 0);
        else if (t.type === 'expense' || t.type === 'reward_payout') totalFund -= Number(t.amount || 0);
      }
    }

    return NextResponse.json({
      pendingMembers: 0,
      pendingPBApprovals: 0,
      totalFund,
      monthlyCollection: 0,
      pendingFines,
      activeChallenges,
      totalMembers,
    });
  } catch (err: unknown) {
    serverDebug.error('[admin/overview] exception', err);
    const status = (err as Record<string, unknown>)?.status || 500;
    return NextResponse.json({ error: (err as Record<string, unknown>)?.message || String(err) }, { status: typeof status === 'number' ? status : 500 });
  }
}
