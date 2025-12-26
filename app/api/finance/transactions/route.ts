import { getSupabaseServiceClient } from '@/lib/supabase-service-client';
import { cookies } from 'next/headers';
import { requireAdminFromRequest } from '@/lib/admin-auth';

const ensureServiceRoleConfigured = () => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
};

const hasSessionCookie = (cookieStore: ReturnType<typeof cookies>) =>
  Boolean(cookieStore.get('sb-session') || cookieStore.get('sb-access-token') || cookieStore.get('sb-refresh-token'));

const runAdminCheck = async (cookieStore: ReturnType<typeof cookies>) => {
  await requireAdminFromRequest((name: string) => cookieStore.get(name)?.value);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type QueryBuilder = any;

const queryView = async (svc: ReturnType<typeof getSupabaseServiceClient>, builder: (q: QueryBuilder) => QueryBuilder) => {
  const q = builder(svc.from('view_transactions_master').select('*,member_info:profiles!user_id(full_name)'));
  const { data, error } = await q;
  if (error) throw error;
  return data;
};

export async function GET(req: Request) {
  try {
    const cookieStore = cookies();
    if (!hasSessionCookie(cookieStore)) return new Response(JSON.stringify({ ok: false, error: 'Không xác thực' }), { status: 401, headers: { 'content-type': 'application/json' } });

    ensureServiceRoleConfigured();
    await runAdminCheck(cookieStore);

    const svc = getSupabaseServiceClient();
    const url = new URL(req.url);
    const yearParam = url.searchParams.get('year');
    const year = yearParam ? Number(yearParam) : undefined;
    const listParam = url.searchParams.get('list');
    const idParam = url.searchParams.get('id');

    if (idParam) {
      const data = await queryView(svc, (q: QueryBuilder) => q.eq('id', idParam).maybeSingle());
      return new Response(JSON.stringify({ ok: true, data }), { status: 200, headers: { 'content-type': 'application/json' } });
    }

    const yearForList = typeof year === 'number' && !Number.isNaN(year) ? year : new Date().getFullYear();

    if (listParam) {
      if (listParam === 'income_paid') {
        const data = await queryView(svc, (q: QueryBuilder) => q.eq('fiscal_year', yearForList).eq('flow_type', 'in').eq('payment_status', 'paid').order('created_at', { ascending: false }));
        return new Response(JSON.stringify({ ok: true, data }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (listParam === 'expense_paid') {
        const data = await queryView(svc, (q: QueryBuilder) => q.eq('fiscal_year', yearForList).eq('flow_type', 'out').eq('payment_status', 'paid').order('created_at', { ascending: false }));
        return new Response(JSON.stringify({ ok: true, data }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (listParam === 'pending') {
        const data = await queryView(svc, (q: QueryBuilder) => q.eq('fiscal_year', yearForList).eq('payment_status', 'pending').order('created_at', { ascending: false }));
        return new Response(JSON.stringify({ ok: true, data }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (listParam === 'all' || listParam === 'problematic') {
        const data = await queryView(svc, (q: QueryBuilder) => q.eq('fiscal_year', yearForList).order('created_at', { ascending: false }));
        return new Response(JSON.stringify({ ok: true, data }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
    }

    const q = url.searchParams.get('q')?.trim();
    const statusParam = url.searchParams.get('status');
    const flowParam = url.searchParams.get('flow_type');
    const userIdParam = url.searchParams.get('user_id');
    const excludeCat = url.searchParams.get('exclude_category_code');

    if (!q && !statusParam && !flowParam && !userIdParam && !excludeCat) {
      const data = await queryView(svc, (qq: QueryBuilder) => qq.eq('fiscal_year', yearForList).order('created_at', { ascending: false }));
      return new Response(JSON.stringify({ ok: true, data }), { status: 200, headers: { 'content-type': 'application/json' } });
    }

    const data = await queryView(svc, (qq: QueryBuilder) => {
      let qq2 = qq.order('created_at', { ascending: false });
      if (typeof year === 'number' && !Number.isNaN(year)) qq2 = qq2.eq('fiscal_year', year);
      if (statusParam) qq2 = qq2.eq('payment_status', statusParam);
      if (userIdParam) qq2 = qq2.eq('user_id', userIdParam);
      if (flowParam) qq2 = qq2.eq('flow_type', flowParam);
      if (q) {
        const safe = q.replace(/,/g, ' ');
        const like = `%${safe}%`;
        const orExpr = `description.ilike.${like},profiles.full_name.ilike.${like},category_name.ilike.${like},category_code.ilike.${like}`;
        qq2 = qq2.or(orExpr);
      }
      if (excludeCat) qq2 = qq2.neq('category_code', excludeCat);
      return qq2;
    });

    return new Response(JSON.stringify({ ok: true, data }), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch (err) {
    console.error('[api/finance/transactions] GET error', String(err));
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
}

export async function PUT(req: Request) {
  try {
    const cookieStore = cookies();
    if (!hasSessionCookie(cookieStore)) return new Response(JSON.stringify({ ok: false, error: 'Không xác thực' }), { status: 401, headers: { 'content-type': 'application/json' } });
    ensureServiceRoleConfigured();
    await runAdminCheck(cookieStore);

    const svc = getSupabaseServiceClient();
    const body = await req.json().catch(() => ({}));
    const id = body?.id;
    const updates = body?.updates ?? {};
    if (!id) return new Response(JSON.stringify({ ok: false, error: 'missing id' }), { status: 400, headers: { 'content-type': 'application/json' } });

    try {
      const { data: rpcData, error: rpcErr } = await svc.rpc('admin_update_transaction', { p_id: id, p_updates: updates }).maybeSingle();
      if (!rpcErr) return new Response(JSON.stringify({ ok: true, data: rpcData }), { status: 200, headers: { 'content-type': 'application/json' } });
      console.warn('[api/finance/transactions] admin_update_transaction rpc error, falling back', rpcErr);
    } catch (e) {
      console.info('[api/finance/transactions] rpc admin_update_transaction not available, falling back', String(e));
    }

    const { data, error } = await svc.from('transactions').update(updates).eq('id', id).select().maybeSingle();
    if (error) return new Response(JSON.stringify({ ok: false, error: String(error) }), { status: 500, headers: { 'content-type': 'application/json' } });

    return new Response(JSON.stringify({ ok: true, data }), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch (err) {
    console.error('[api/finance/transactions] PUT error', String(err));
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = cookies();
    if (!hasSessionCookie(cookieStore)) return new Response(JSON.stringify({ ok: false, error: 'Không xác thực' }), { status: 401, headers: { 'content-type': 'application/json' } });
    ensureServiceRoleConfigured();
    await runAdminCheck(cookieStore);

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

    try {
      const { data: rpcData, error: rpcErr } = await svc.rpc('admin_create_transaction', {
        p_category_code: categoryCode,
        p_amount: amount,
        p_description: description,
        p_user_id: userId,
        p_metadata: metadata,
        p_fiscal_year: fiscal_year ?? new Date().getFullYear(),
        p_period_month: period_month ?? new Date().getMonth() + 1,
      }).maybeSingle();
      if (!rpcErr) return new Response(JSON.stringify({ ok: true, data: rpcData }), { status: 200, headers: { 'content-type': 'application/json' } });
      console.warn('[api/finance/transactions] admin_create_transaction rpc error, falling back', rpcErr);
    } catch (e) {
      console.info('[api/finance/transactions] rpc admin_create_transaction not available, falling back to table insert', String(e));
    }

    const { data: cat, error: catErr } = await svc.from('financial_categories').select('id').eq('code', categoryCode).maybeSingle();
    if (catErr) return new Response(JSON.stringify({ ok: false, error: String(catErr) }), { status: 500, headers: { 'content-type': 'application/json' } });
    if (!cat) return new Response(JSON.stringify({ ok: false, error: 'category not found' }), { status: 400, headers: { 'content-type': 'application/json' } });

    const insertRow = {
      category_id: cat.id,
      user_id: userId,
      amount,
      description,
      metadata,
      payment_status: 'pending',
      fiscal_year: typeof fiscal_year === 'number' ? fiscal_year : new Date().getFullYear(),
      period_month: typeof period_month === 'number' ? period_month : new Date().getMonth() + 1,
    };

    const { data, error } = await svc.from('transactions').insert(insertRow).select().maybeSingle();
    if (error) return new Response(JSON.stringify({ ok: false, error: String(error) }), { status: 500, headers: { 'content-type': 'application/json' } });

    return new Response(JSON.stringify({ ok: true, data }), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch (err) {
    console.error('[api/finance/transactions] POST error', String(err));
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
}

export const dynamic = 'force-dynamic';
