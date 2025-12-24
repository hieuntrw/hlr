import { getSupabaseServiceClient } from '@/lib/supabase-service-client';
import { cookies } from 'next/headers';
import { decodeSbSessionCookie } from '@/lib/server-auth';

export async function GET(req: Request) {
  try {
    const cookieStore = cookies();
    const hasAccess = Boolean(cookieStore.get('sb-access-token') || cookieStore.get('sb-session') || cookieStore.get('sb-refresh-token'));
    if (!hasAccess) {
      return new Response(JSON.stringify({ ok: false, error: 'Không xác thực' }), { status: 401, headers: { 'content-type': 'application/json' } });
    }

    const sbRaw = cookieStore.get('sb-session')?.value ?? cookieStore.get('sb-access-token')?.value;
    const reconstructed = await decodeSbSessionCookie(sbRaw);
    if (!reconstructed) {
      return new Response(JSON.stringify({ ok: false, error: 'Không xác thực' }), { status: 401, headers: { 'content-type': 'application/json' } });
    }

    const url = new URL(req.url);
    const yearParam = url.searchParams.get('year') ?? String(new Date().getFullYear());
    const year = Number(yearParam) || new Date().getFullYear();

    const svc = getSupabaseServiceClient();
    const { data, error } = await svc
      .from('view_finance_report_by_category')
      .select('*')
      .eq('fiscal_year', year)
      .order('total_amount', { ascending: false });

    if (error) {
      throw error;
    }

    return new Response(JSON.stringify({ ok: true, data }), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch (err) {
    console.error('[api/finance/report] error', String(err));
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
}

export const dynamic = 'force-dynamic';
