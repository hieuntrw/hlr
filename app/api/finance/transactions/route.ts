import { getSupabaseServiceClient } from '@/lib/supabase-service-client';

export async function GET(req: Request) {
  try {
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
