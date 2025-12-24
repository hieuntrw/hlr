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
    const yearParam = url.searchParams.get('year');
    const limitParam = url.searchParams.get('limit') ?? '100';
    const offsetParam = url.searchParams.get('offset') ?? '0';
    const year = yearParam ? Number(yearParam) : undefined;
    const limit = Math.min(Math.max(Number(limitParam) || 100, 1), 1000);
    const offset = Math.max(Number(offsetParam) || 0, 0);

    const svc = getSupabaseServiceClient();

    let query = svc
      .from('transactions')
      .select(`
        *,
        member_info:profiles!user_id(full_name),
        financial_categories(name, flow_type, code)
      `)
      .order('payment_status', { ascending: false })
      .order('created_at', { ascending: false });

    if (typeof year === 'number' && !Number.isNaN(year)) {
      query = query.eq('fiscal_year', year);
    }

    // server-side search / filters
    const q = url.searchParams.get('q')?.trim();
    const statusParam = url.searchParams.get('status');
    const flowParam = url.searchParams.get('flow_type');
    const userIdParam = url.searchParams.get('user_id');

    if (statusParam) {
      query = query.eq('payment_status', statusParam);
    }
    if (userIdParam) {
      query = query.eq('user_id', userIdParam);
    }
    if (flowParam) {
      // filter by joined financial_categories.flow_type
      query = query.eq('financial_categories.flow_type', flowParam);
    }

    if (q) {
      // simple ilike search across description, profile name and category name/code
      const safe = q.replace(/,/g, ' ');
      const like = `%${safe}%`;
      const orExpr = `description.ilike.${like},profiles.full_name.ilike.${like},financial_categories.name.ilike.${like},financial_categories.code.ilike.${like}`;
      query = query.or(orExpr);
    }

    // support excluding a category code (e.g., OPENING_BALANCE)
    const excludeCat = url.searchParams.get('exclude_category_code');
    if (excludeCat) {
      query = query.neq('financial_categories.code', excludeCat);
    }

    // use range for pagination (offset..offset+limit-1)
    const from = offset;
    const to = offset + limit - 1;
    const { data, error } = await query.range(from, to);

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
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[api/finance/transactions] SUPABASE_SERVICE_ROLE_KEY not configured');
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

export async function POST(req: Request) {
  try {
    // Require admin/mod role to create transactions
    const cookieStore = cookies();
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[api/finance/transactions] SUPABASE_SERVICE_ROLE_KEY not configured');
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

    const svc = getSupabaseServiceClient();
    const body = await req.json().catch(() => ({}));

    const categoryCode = body?.category_code;
    const amount = Number(body?.amount ?? 0);
    const description = body?.description ?? '';
    const userId = body?.user_id ?? null;
    const metadata = body?.metadata ?? {};
    const fiscal_year = typeof body?.fiscal_year === 'number' ? body.fiscal_year : (typeof body?.fiscal_year === 'string' ? Number(body.fiscal_year) : undefined);
    const period_month = typeof body?.period_month === 'number' ? body.period_month : (typeof body?.period_month === 'string' ? Number(body.period_month) : undefined);

    if (!categoryCode) return new Response(JSON.stringify({ ok: false, error: 'missing category_code' }), { status: 400, headers: { 'content-type': 'application/json' } });
    if (!amount || Number.isNaN(amount)) return new Response(JSON.stringify({ ok: false, error: 'invalid amount' }), { status: 400, headers: { 'content-type': 'application/json' } });

    // Resolve category id
    const { data: cat, error: catErr } = await svc.from('financial_categories').select('id').eq('code', categoryCode).maybeSingle();
    if (catErr) {
      console.error('[api/finance/transactions] category lookup error', catErr);
      return new Response(JSON.stringify({ ok: false, error: String(catErr) }), { status: 500, headers: { 'content-type': 'application/json' } });
    }
    if (!cat) return new Response(JSON.stringify({ ok: false, error: 'category not found' }), { status: 400, headers: { 'content-type': 'application/json' } });

    const insertRow = {
      category_id: cat.id,
      user_id: userId,
      amount: amount,
      description: description,
      metadata: metadata,
      payment_status: 'pending',
      fiscal_year: typeof fiscal_year === 'number' ? fiscal_year : new Date().getFullYear(),
      period_month: typeof period_month === 'number' ? period_month : new Date().getMonth() + 1,
    };

    const { data, error } = await svc.from('transactions').insert(insertRow).select().maybeSingle();
    if (error) {
      console.error('[api/finance/transactions] insert error', error);
      return new Response(JSON.stringify({ ok: false, error: String(error) }), { status: 500, headers: { 'content-type': 'application/json' } });
    }

    return new Response(JSON.stringify({ ok: true, data }), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch (err) {
    console.error('[api/finance/transactions] POST error', String(err));
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
}

export const dynamic = 'force-dynamic';
