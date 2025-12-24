import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import getSupabaseServiceClient from '@/lib/supabase-service-client';
import serverDebug from '@/lib/server-debug';
import ensureAdmin from '@/lib/server-auth';
// use internal totals API instead of calling financeService RPC directly


export const dynamic = 'force-dynamic';

async function getServiceClient() {
  try {
    return getSupabaseServiceClient();
  } catch {
    return null;
  }
}

// use shared `ensureAdmin` helper

export async function GET(request: NextRequest) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      serverDebug.error('SUPABASE_SERVICE_ROLE_KEY not configured');
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { cookies: { get(name: string) { return request.cookies.get(name)?.value }, set() {}, remove() {} } }
    );

    // Ensure caller is admin/mod (allow helper to reconstruct session from cookies)
    await ensureAdmin(supabaseAuth, (name: string) => request.cookies.get(name)?.value);

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

    // Fetch club balance from internal totals API so logic is centralized
    let totalFund = 0;
    try {
      const origin = new URL(request.url).origin;
      const totalsResp = await fetch(`${origin}/api/finance/totals?year=${new Date().getFullYear()}`, {
        headers: { cookie: request.headers.get('cookie') || '' },
        cache: 'no-store',
      });
      if (totalsResp.ok) {
        const body = await totalsResp.json().catch(() => null);
        const totals = body?.totals ?? null;
        totalFund = Number(totals?.clubBalance ?? totals?.club_balance ?? 0) || 0;
      } else {
        serverDebug.warn('[admin/overview] /api/finance/totals responded non-OK', { status: totalsResp.status });
      }
    } catch (err) {
      serverDebug.error('[admin/overview] failed to fetch /api/finance/totals', err);
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
