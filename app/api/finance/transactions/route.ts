import { getSupabaseServiceClient } from '@/lib/supabase-service-client';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { ensureAdmin } from '@/lib/server-auth';

export async function GET(req: Request) {
  try {
    // Require auth cookie to be present (sb-access-token / sb-session / sb-refresh-token)
    const cookieStore = cookies();
    const hasAccess = Boolean(cookieStore.get('sb-access-token') || cookieStore.get('sb-session') || cookieStore.get('sb-refresh-token'));
    if (!hasAccess) {
      return new Response(JSON.stringify({ ok: false, error: 'Không xác thực' }), { status: 401, headers: { 'content-type': 'application/json' } });
    }

    const url = new URL(req.url);
    const yearParam = url.searchParams.get('year') ?? String(new Date().getFullYear());
    const limitParam = url.searchParams.get('limit') ?? '100';
    const year = Number(yearParam) || new Date().getFullYear();
    const limit = Math.min(Math.max(Number(limitParam) || 100, 1), 1000);

    const svc = getSupabaseServiceClient();

    const { data, error } = await svc
      .from('transactions')
      .select(`
        *,
        member_info:profiles!user_id(full_name),
        financial_categories(name, flow_type, code)
      `)
      .eq('fiscal_year', year)
      .order('payment_status', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[api/finance/transactions] list error', error);
      return new Response(JSON.stringify({ ok: false, error: String(error) }), { status: 500, headers: { 'content-type': 'application/json' } });
    }

    return new Response(JSON.stringify({ ok: true, data }), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch (err) {
    console.error('[api/finance/transactions] GET error', String(err));
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
}

export async function PUT(req: Request) {
  try {
    // Require admin/mod role to perform mutations
    const cookieStore = cookies();
    const supabaseAuth = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    });
    await ensureAdmin(supabaseAuth, (name: string) => cookieStore.get(name)?.value);

    const svc = getSupabaseServiceClient();
    const body = await req.json().catch(() => ({}));
    const id = body?.id;
    const updates = body?.updates ?? {};
    if (!id) return new Response(JSON.stringify({ ok: false, error: 'missing id' }), { status: 400, headers: { 'content-type': 'application/json' } });

    const { data, error } = await svc.from('transactions').update(updates).eq('id', id).select().maybeSingle();
    if (error) {
      console.error('[api/finance/transactions] update error', error);
      return new Response(JSON.stringify({ ok: false, error: String(error) }), { status: 500, headers: { 'content-type': 'application/json' } });
    }

    return new Response(JSON.stringify({ ok: true, data }), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch (err) {
    console.error('[api/finance/transactions] PUT error', String(err));
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
}

export const dynamic = 'force-dynamic';
