import { getSupabaseServiceClient } from '@/lib/supabase-service-client';
import { cookies } from 'next/headers';
import { decodeSbSessionCookie, ensureAdmin } from '@/lib/server-auth';
import { createServerClient } from '@supabase/ssr';

export async function GET(req: Request) {
  try {
    // Require an auth cookie to be present before allowing service-role queries.
    const cookieStore = cookies();
    const hasAccess = Boolean(cookieStore.get('sb-access-token') || cookieStore.get('sb-session') || cookieStore.get('sb-refresh-token'));
    if (!hasAccess) {
      return new Response(JSON.stringify({ ok: false, error: 'Không xác thực' }), { status: 401, headers: { 'content-type': 'application/json' } });
    }

    // Try to reconstruct a minimal user from the `sb-session` or raw access token.
    const sbRaw = cookieStore.get('sb-session')?.value ?? cookieStore.get('sb-access-token')?.value;
    const reconstructed = await decodeSbSessionCookie(sbRaw);
    if (!reconstructed) {
      return new Response(JSON.stringify({ ok: false, error: 'Không xác thực' }), { status: 401, headers: { 'content-type': 'application/json' } });
    }
    const url = new URL(req.url);
    const yearParam = url.searchParams.get('year') ?? String(new Date().getFullYear());
    const year = Number(yearParam) || new Date().getFullYear();

    const svc = getSupabaseServiceClient();

    const [incomeRes, expenseRes, pendingRes, clubRes] = await Promise.all([
      svc.rpc('get_total_income_real', { year_input: year }),
      svc.rpc('get_total_expense', { year_input: year }),
      svc.rpc('get_total_pending_income', { year_input: year }),
      svc.rpc('get_club_balance', { year_input: year }),
    ]);

    const openingRes = await svc
      .from('view_finance_report_by_category')
      .select('total_amount, category_code')
      .eq('fiscal_year', year)
      .eq('category_code', 'OPENING_BALANCE')
      .maybeSingle();

    const openingRow = openingRes.data as { total_amount: number | string | null } | null;
    const openingBalance = Number(openingRow?.total_amount ?? 0);

    const toNumber = (r: unknown) => {
      try {
        if (!r) return 0;
        const rr = r as Record<string, unknown>;
        const data = rr.data as unknown;
        if (typeof data === 'number') return data as number;
        if (Array.isArray(data) && data.length > 0) return Number((data as unknown as unknown[])[0]);
        return Number(data ?? 0);
      } catch {
        return 0;
      }
    };

    const totalIncomeReal = toNumber(incomeRes);
    const totalExpense = toNumber(expenseRes);
    const pendingIncome = toNumber(pendingRes);
    const clubBalance = toNumber(clubRes);

    return new Response(JSON.stringify({ ok: true, totals: { openingBalance, totalIncomeReal, totalExpense, pendingIncome, clubBalance } }), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch (err) {
    console.error('[api/finance/totals] error', String(err));
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
}

export async function POST(req: Request) {
  try {
    // Admin-only: create or update opening balance for next year via RPC create_opening_balance
    const cookieStore = cookies();
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[api/finance/totals] SUPABASE_SERVICE_ROLE_KEY not configured');
      return new Response(JSON.stringify({ ok: false, error: 'Server not configured' }), { status: 500, headers: { 'content-type': 'application/json' } });
    }

    const supabaseAuth = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    });
    await ensureAdmin(supabaseAuth, (name: string) => cookieStore.get(name)?.value);

    const body = await req.json().catch(() => ({}));
    const prevYear = typeof body?.prev_year === 'number' ? body.prev_year : (typeof body?.prev_year === 'string' ? Number(body.prev_year) : undefined);
    if (!prevYear) return new Response(JSON.stringify({ ok: false, error: 'missing prev_year' }), { status: 400, headers: { 'content-type': 'application/json' } });

    const svc = getSupabaseServiceClient();
    const { error } = await svc.rpc('create_opening_balance', { prev_year: prevYear });
    if (error) {
      console.error('[api/finance/totals] create_opening_balance error', error);
      return new Response(JSON.stringify({ ok: false, error: String(error) }), { status: 500, headers: { 'content-type': 'application/json' } });
    }

    return new Response(JSON.stringify({ ok: true, data: { success: true } }), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch (err) {
    console.error('[api/finance/totals] POST error', String(err));
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
}

export const dynamic = 'force-dynamic';
