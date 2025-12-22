import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import serverDebug from '@/lib/server-debug';
import ensureAdmin from '@/lib/server-auth';
import  {financeService}  from '@/lib/services/financeService';


export const dynamic = 'force-dynamic';

async function getServiceClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// use shared `ensureAdmin` helper

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
    const pendingResp = await client.from('transactions').select('*', { count: 'exact', head: true }).eq('payment_status', 'pending').eq('fiscal_year', new Date().getFullYear());
    const pendingFines = pendingResp.count ?? 0;

    // Prefer the financeService RPC for club balance (uses service/client RPC)
    const totalFund = await financeService.getClubBalance(new Date().getFullYear());
    

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
