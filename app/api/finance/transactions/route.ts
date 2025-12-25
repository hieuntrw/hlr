import { getSupabaseServiceClient } from '@/lib/supabase-service-client';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { ensureAdmin } from '@/lib/server-auth';

// Local helpers that query the view_transactions_master view
const getIncomePaid = async (
  cookieStore: ReturnType<typeof cookies>,
  svc: ReturnType<typeof getSupabaseServiceClient>,
  year: number,
) => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[getIncomePaid] SUPABASE_SERVICE_ROLE_KEY not configured');
    return { ok: false, error: 'Server not configured' };
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
  try {
    await ensureAdmin(supabaseAuth, (name: string) => cookieStore.get(name)?.value);
  } catch (e) {
    console.error('[getIncomePaid] ensureAdmin failed', String(e));
    return { ok: false, error: 'Insufficient permissions' };
  }

  const { data, error } = await svc
    .from('view_transactions_master')
    .select('*,member_info:profiles!user_id(full_name)')
    .eq('fiscal_year', year)
    .eq('flow_type', 'in')
    .eq('payment_status', 'paid')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[getIncomePaid] error', error);
    return { ok: false, error };
  }
  return { ok: true, data };
};

const getExpensePaid = async (
  cookieStore: ReturnType<typeof cookies>,
  svc: ReturnType<typeof getSupabaseServiceClient>,
  year: number,
) => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[getExpensePaid] SUPABASE_SERVICE_ROLE_KEY not configured');
    return { ok: false, error: 'Server not configured' };
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
  try {
    await ensureAdmin(supabaseAuth, (name: string) => cookieStore.get(name)?.value);
  } catch (e) {
    console.error('[getExpensePaid] ensureAdmin failed', String(e));
    return { ok: false, error: 'Insufficient permissions' };
  }

  const { data, error } = await svc
    .from('view_transactions_master')
    .select('*,member_info:profiles!user_id(full_name)')
    .eq('fiscal_year', year)
    .eq('flow_type', 'out')
    .eq('payment_status', 'paid')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[getExpensePaid] error', error);
    return { ok: false, error };
  }
  return { ok: true, data };
};

const getPendingTransactions = async (
  cookieStore: ReturnType<typeof cookies>,
  svc: ReturnType<typeof getSupabaseServiceClient>,
  year: number,
) => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[getPendingTransactions] SUPABASE_SERVICE_ROLE_KEY not configured');
    return { ok: false, error: 'Server not configured' };
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
  try {
    await ensureAdmin(supabaseAuth, (name: string) => cookieStore.get(name)?.value);
  } catch (e) {
    console.error('[getPendingTransactions] ensureAdmin failed', String(e));
    return { ok: false, error: 'Insufficient permissions' };
  }

  const { data, error } = await svc
    .from('view_transactions_master')
    .select('*,member_info:profiles!user_id(full_name)')
    .eq('fiscal_year', year)
    .eq('payment_status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[getPendingTransactions] error', error);
    return { ok: false, error };
  }
  return { ok: true, data };
};

const getAllTransactions = async (
  cookieStore: ReturnType<typeof cookies>,
  svc: ReturnType<typeof getSupabaseServiceClient>,
  year: number,
) => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[getAllTransactions] SUPABASE_SERVICE_ROLE_KEY not configured');
    return { ok: false, error: 'Server not configured' };
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
  try {
    await ensureAdmin(supabaseAuth, (name: string) => cookieStore.get(name)?.value);
  } catch (e) {
    console.error('[getAllTransactions] ensureAdmin failed', String(e));
    return { ok: false, error: 'Insufficient permissions' };
  }

  const { data, error } = await svc
    .from('view_transactions_master')
    .select('*,member_info:profiles!user_id(full_name)')
    .eq('fiscal_year', year)
    .order('created_at', { ascending: false });
    if (error) {
    console.error('[getAllTransactions] error', error);
    return { ok: false, error };
  }
  return { ok: true, data };
};

// Generic filtered query against view_transactions_master using server role
const getFilteredTransactions = async (
  cookieStore: ReturnType<typeof cookies>,
  svc: ReturnType<typeof getSupabaseServiceClient>,
  year: number,
  payment_status?: string | null,
  flow_type?: string | null,
 ) => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[getFilteredTransactions] SUPABASE_SERVICE_ROLE_KEY not configured');
    return { ok: false, error: 'Server not configured' };
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
  try {
    await ensureAdmin(supabaseAuth, (name: string) => cookieStore.get(name)?.value);
  } catch (e) {
    console.error('[getFilteredTransactions] ensureAdmin failed', String(e));
    return { ok: false, error: 'Insufficient permissions' };
  }

  let q = svc
    .from('view_transactions_master')
    .select('*,member_info:profiles!user_id(full_name)')
    .order('created_at', { ascending: false });

  if (typeof year === 'number' && !Number.isNaN(year)) q = q.eq('fiscal_year', year);
  if (payment_status) q = q.eq('payment_status', payment_status);
  if (flow_type) q = q.eq('flow_type', flow_type);

  const { data, error } = await q;
  if (error) {
    console.error('[getFilteredTransactions] error', error);
    return { ok: false, error };
  }
  return { ok: true, data };
};

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
    const year = yearParam ? Number(yearParam) : undefined;

    const svc = getSupabaseServiceClient();
    const idParamSingle = url.searchParams.get('id');

    // If requesting a single transaction by id, return it (admin-only)
    if (idParamSingle) {
      if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.error('[api/finance/transactions] SUPABASE_SERVICE_ROLE_KEY not configured');
        return new Response(JSON.stringify({ ok: false, error: 'Server not configured' }), { status: 500, headers: { 'content-type': 'application/json' } });
      }
      const supabaseAuthSingle = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
        cookies: {
          get(name: string) {
            return cookies().get(name)?.value;
          },
          set() {},
          remove() {},
        },
      });
      try {
        await ensureAdmin(supabaseAuthSingle, (name: string) => cookies().get(name)?.value);
      } catch (e) {
        console.error('[api/finance/transactions] ensureAdmin failed for id fetch', String(e));
        return new Response(JSON.stringify({ ok: false, error: 'Insufficient permissions' }), { status: 403, headers: { 'content-type': 'application/json' } });
      }

      const { data, error } = await svc
        .from('view_transactions_master')
        .select('*,member_info:profiles!user_id(full_name)')
        .eq('id', idParamSingle)
        .maybeSingle();
      if (error) {
        console.error('[api/finance/transactions] fetch by id error', error);
        return new Response(JSON.stringify({ ok: false, error: String(error) }), { status: 500, headers: { 'content-type': 'application/json' } });
      }
      return new Response(JSON.stringify({ ok: true, data }), { status: 200, headers: { 'content-type': 'application/json' } });
    }

    // If caller requested a specific list view, validate cookies and permissions, then return it
    const listParam = url.searchParams.get('list');
    if (listParam) {
      // require server-side admin/mod_finance before returning these lists
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
      try {
        await ensureAdmin(supabaseAuth, (name: string) => cookieStore.get(name)?.value);
      } catch (e) {
        console.error('[api/finance/transactions] ensureAdmin failed', String(e));
        return new Response(JSON.stringify({ ok: false, error: 'Insufficient permissions' }), { status: 403, headers: { 'content-type': 'application/json' } });
      }

      const yearForList = typeof year === 'number' && !Number.isNaN(year) ? year : new Date().getFullYear();
      if (listParam === 'income_paid') {
        const resp = await getIncomePaid(cookieStore, svc, yearForList);
        return new Response(JSON.stringify(resp), { status: resp.ok ? 200 : 500, headers: { 'content-type': 'application/json' } });
      }
      if (listParam === 'expense_paid') {
        const resp = await getExpensePaid(cookieStore, svc, yearForList);
        return new Response(JSON.stringify(resp), { status: resp.ok ? 200 : 500, headers: { 'content-type': 'application/json' } });
      }
      if (listParam === 'pending') {
        const resp = await getPendingTransactions(cookieStore, svc, yearForList);
        return new Response(JSON.stringify(resp), { status: resp.ok ? 200 : 500, headers: { 'content-type': 'application/json' } });
      }
      if (listParam === 'problematic' || listParam === 'all') {
        const resp = await getAllTransactions(cookieStore, svc, yearForList);
        return new Response(JSON.stringify(resp), { status: resp.ok ? 200 : 500, headers: { 'content-type': 'application/json' } });
      }
    }

    // Use view_transactions_master for all list queries (require admin role)
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
    try {
      await ensureAdmin(supabaseAuth, (name: string) => cookieStore.get(name)?.value);
    } catch (e) {
      console.error('[api/finance/transactions] ensureAdmin failed', String(e));
      return new Response(JSON.stringify({ ok: false, error: 'Insufficient permissions' }), { status: 403, headers: { 'content-type': 'application/json' } });
    }

    // If no filters/search provided, reuse the existing helper which queries the
    // `view_transactions_master` view instead of building a new query here.
    const q = url.searchParams.get('q')?.trim();
    const statusParam = url.searchParams.get('status');
    const flowParam = url.searchParams.get('flow_type');
    const userIdParam = url.searchParams.get('user_id');
    const excludeCat = url.searchParams.get('exclude_category_code');

    const noFilters = !q && !statusParam && !flowParam && !userIdParam && !excludeCat;
    if (noFilters) {
      const yearForList = typeof year === 'number' && !Number.isNaN(year) ? year : new Date().getFullYear();
      const resp = await getAllTransactions(cookieStore, svc, yearForList);
      return new Response(JSON.stringify(resp), { status: resp.ok ? 200 : 500, headers: { 'content-type': 'application/json' } });
    }

    // If the request is a simple filter by payment_status and/or flow_type,
    // delegate to `getFilteredTransactions` which queries the
    // `view_transactions_master` view (no pagination).
    const yearForList = typeof year === 'number' && !Number.isNaN(year) ? year : new Date().getFullYear();
    if ((statusParam || flowParam) && !q && !userIdParam && !excludeCat) {
      const resp = await getFilteredTransactions(cookieStore, svc, yearForList, statusParam ?? undefined, flowParam ?? undefined);
      return new Response(JSON.stringify(resp), { status: resp.ok ? 200 : 500, headers: { 'content-type': 'application/json' } });
    }

    // Build query against the view for more complex filtered/search scenarios
    let viewQuery = svc
      .from('view_transactions_master')
      .select('*,member_info:profiles!user_id(full_name)')
      .order('created_at', { ascending: false });

    if (typeof year === 'number' && !Number.isNaN(year)) {
      viewQuery = viewQuery.eq('fiscal_year', year);
    }

    if (statusParam) viewQuery = viewQuery.eq('payment_status', statusParam);
    if (userIdParam) viewQuery = viewQuery.eq('user_id', userIdParam);
    if (flowParam) viewQuery = viewQuery.eq('flow_type', flowParam);

    if (q) {
      const safe = q.replace(/,/g, ' ');
      const like = `%${safe}%`;
      const orExpr = `description.ilike.${like},profiles.full_name.ilike.${like},category_name.ilike.${like},category_code.ilike.${like}`;
      viewQuery = viewQuery.or(orExpr);
    }

    if (excludeCat) viewQuery = viewQuery.neq('category_code', excludeCat);

    // no pagination: return all matched rows from the view
    const { data, error } = await viewQuery;

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

    // Prefer calling a DB RPC for controlled updates (server-side business logic).
    try {
      const { data: rpcData, error: rpcErr } = await svc.rpc('admin_update_transaction', { p_id: id, p_updates: updates }).maybeSingle();
      if (!rpcErr) {
        return new Response(JSON.stringify({ ok: true, data: rpcData }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      // If RPC exists but returned an error, log and fall back to direct update
      console.warn('[api/finance/transactions] admin_update_transaction rpc error, falling back', rpcErr);
    } catch (err) {
      // RPC might not exist — fall back to legacy behavior
      console.info('[api/finance/transactions] rpc admin_update_transaction not available, falling back to table update', String(err));
    }

    // Fallback: perform direct update on transactions table (legacy path)
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

    // Prefer RPC-based creation if available
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
      if (!rpcErr) {
        return new Response(JSON.stringify({ ok: true, data: rpcData }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      console.warn('[api/finance/transactions] admin_create_transaction rpc error, falling back', rpcErr);
    } catch (err) {
      console.info('[api/finance/transactions] rpc admin_create_transaction not available, falling back to table insert', String(err));
    }

    // Fallback: Resolve category id and insert directly
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
