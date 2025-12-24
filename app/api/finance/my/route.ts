import { getSupabaseServiceClient } from '@/lib/supabase-service-client';

function parseCookies(header: string | null) {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const [k, ...rest] = part.split('=');
    if (!k) continue;
    out[k.trim()] = decodeURIComponent((rest || []).join('=').trim());
  }
  return out;
}

function decodeJwtPayload(token?: string) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = parts[1];
    const padded = payload.padEnd(payload.length + (4 - (payload.length % 4)) % 4, '=');
    const json = Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  try {
    // (debug helper removed)
    const cookieHeader = req.headers.get('cookie') ?? null;
    const cookies = parseCookies(cookieHeader);

    // Prefer sb-session (encoded JSON) then sb-access-token
    let accessToken: string | undefined;
    if (cookies['sb-session']) {
      try {
        const parsed = JSON.parse(decodeURIComponent(cookies['sb-session'] || '{}')) as Record<string, unknown>;
        accessToken = typeof (parsed as Record<string, unknown>)['access_token'] === 'string' ? String((parsed as Record<string, unknown>)['access_token']) : undefined;
      } catch {
        accessToken = undefined;
      }
    }
    accessToken = accessToken || cookies['sb-access-token'];

    const url = new URL(req.url);

    const payload = decodeJwtPayload(accessToken);
    const userId = payload?.sub || payload?.user_id || null;

    const yearParam = url.searchParams.get('year') ?? String(new Date().getFullYear());
    const year = Number(yearParam) || new Date().getFullYear();

    if (!userId) return new Response(JSON.stringify({ ok: false, error: 'Unauthenticated' }), { status: 401 });

    // Extended diagnostics: call RPCs directly and return raw results when requested
    if (url.searchParams.get('__diag') === '1') {
      try {
        const svc = getSupabaseServiceClient();

        // allow overriding target user id for diagnostics (e.g., ?target_user=...)
        const diagUserId = url.searchParams.get('target_user') ?? userId;

        // Call RPCs individually to capture raw responses
        const rpcIncome = await svc.rpc('get_total_income_real', { year_input: year });
        const rpcExpense = await svc.rpc('get_total_expense', { year_input: year });
        const rpcPending = await svc.rpc('get_total_pending_income', { year_input: year });
        const rpcClub = await svc.rpc('get_club_balance', {});

        // Fetch small samples from transactions and the view
        const { data: txsSample, error: txErr } = await svc
          .from('transactions')
          .select('*')
          .eq('user_id', diagUserId)
          .eq('fiscal_year', year)
          .order('payment_status', { ascending: false })
          .limit(10);

        const { data: viewSample, error: viewErr } = await svc
          .from('view_my_finance_status')
          .select('*')
          .eq('user_id', diagUserId)
          .eq('fiscal_year', year)
          .limit(5);

        return new Response(JSON.stringify({
          ok: true,
          diag: {
            rpcIncome,
            rpcExpense,
            rpcPending,
            rpcClub,
            txsSample: txsSample ?? null,
            txErr: txErr ?? null,
            viewSample: viewSample ?? null,
            viewErr: viewErr ?? null,
          }
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      } catch (dErr) {
        console.error('[api/finance/my] diag error', String(dErr));
        return new Response(JSON.stringify({ ok: false, error: String(dErr) }), { status: 500, headers: { 'content-type': 'application/json' } });
      }
    }

    try {
      const svc = getSupabaseServiceClient();

      // Allow admin/mod to request other user's finance via `user_id` query param
      let targetUserId = userId;
      const requestedUserId = url.searchParams.get('user_id') ?? url.searchParams.get('target_user');
      if (requestedUserId) {
          // Determine requesting user's role from JWT `app_metadata` (authoritative).
          // `profiles` does not contain `role`; role is stored in auth app_metadata.
          const payloadObj = payload as Record<string, unknown> | null;
          const requesterRole = payloadObj && payloadObj['app_metadata'] && typeof (payloadObj['app_metadata'] as Record<string, unknown>)['role'] === 'string'
            ? ((payloadObj['app_metadata'] as Record<string, unknown>)['role'] as string)
            : (typeof payloadObj?.['role'] === 'string' ? (payloadObj?.['role'] as string) : '');
          if (requesterRole === 'admin' || requesterRole === 'mod_finance') {
          targetUserId = requestedUserId;
        } else {
          return new Response(JSON.stringify({ ok: false, error: 'Forbidden' }), { status: 403, headers: { 'content-type': 'application/json' } });
        }
      }

      const { data, error, status } = await svc
        .from('view_my_finance_status')
        .select('*')
        .eq('user_id', targetUserId)
        .eq('fiscal_year', year)
        .order('payment_status', { ascending: false })
        .order('created_at', { ascending: false });

      console.log('[api/finance/my] svc response status=', status, 'error=', String(error), 'dataType=', Array.isArray(data) ? 'array' : typeof data);

      if (error) {
        console.error('[api/finance/my] supabase service error', error);
        // If permission denied, attempt to assemble a safe fallback from RPCs/transactions
        if (error?.code === '42501' || error?.message?.toLowerCase?.().includes('permission denied')) {
          try {
            // 1) try RPC totals (these exist and are public to authenticated/service)
            const rpcCalls = [
              svc.rpc('get_total_income_real', { year_input: year }),
              svc.rpc('get_total_expense', { year_input: year }),
              svc.rpc('get_total_pending_income', { year_input: year }),
              svc.rpc('get_club_balance', {}),
            ];

            const settled = await Promise.allSettled(rpcCalls as unknown as Promise<unknown>[]);
            console.log('[api/finance/my] rpc settled statuses=', settled.map(s => s.status));
            settled.forEach((s, i) => {
              try {
                console.log('[api/finance/my] rpc', i, 'value=', JSON.stringify((s as PromiseFulfilledResult<unknown>).value ?? null).slice(0, 200));
              } catch (e) {
                console.log('[api/finance/my] rpc', i, 'stringify-error', String(e));
              }
            });
            const resIncome = settled[0];
            const resExpense = settled[1];
            const resPending = settled[2];
            const resClub = settled[3];

            const totalIncome = resIncome.status === 'fulfilled' && typeof resIncome.value === 'object' && resIncome.value !== null && 'data' in (resIncome.value as Record<string, unknown>)
              ? (resIncome.value as Record<string, unknown>)['data']
              : null;
            const totalExpense = resExpense.status === 'fulfilled' && typeof resExpense.value === 'object' && resExpense.value !== null && 'data' in (resExpense.value as Record<string, unknown>)
              ? (resExpense.value as Record<string, unknown>)['data']
              : null;
            const pending = resPending.status === 'fulfilled' && typeof resPending.value === 'object' && resPending.value !== null && 'data' in (resPending.value as Record<string, unknown>)
              ? (resPending.value as Record<string, unknown>)['data']
              : null;
            const clubBalance = resClub.status === 'fulfilled' && typeof resClub.value === 'object' && resClub.value !== null && 'data' in (resClub.value as Record<string, unknown>)
              ? (resClub.value as Record<string, unknown>)['data']
              : null;

            // 2) fetch recent transactions for the user (may respect RLS but service_role should work)
            const { data: txs, error: txErr } = await svc
              .from('transactions')
              .select('id:user_id, amount, description, created_at, payment_status, fiscal_year, period_month, processed_at, category_id')
              .eq('user_id', userId)
              .eq('fiscal_year', year)
              .order('payment_status', { ascending: false })
              .order('created_at', { ascending: false })
              .limit(50);

            if (txErr) {
              console.warn('[api/finance/my] transactions fallback error', txErr);
            } else {
              try {
                console.log('[api/finance/my] transactions count=', Array.isArray(txs) ? txs.length : typeof txs);
                console.log('[api/finance/my] transactions sample=', JSON.stringify((Array.isArray(txs) ? txs.slice(0,3) : txs) ?? null).slice(0, 400));
              } catch (e) {
                console.log('[api/finance/my] transactions stringify error', String(e));
              }
            }

            const payload = {
              totals: {
                totalIncome: (totalIncome ?? null),
                totalExpense: (totalExpense ?? null),
                pendingIncome: (pending ?? null),
                clubBalance: (clubBalance ?? null),
              },
              transactions: txs ?? [],
            };

            // In dev, if everything failed, return a sample mock for UI convenience
            if ((payload.transactions.length === 0) && !payload.totals.totalIncome && process.env.NODE_ENV !== 'production') {
              const sample = [{
                transaction_id: '00000000-0000-0000-0000-000000000001',
                user_id: userId,
                category_name: 'Thu Quỹ Tháng',
                category_code: 'MONTHLY_FUND',
                flow_type: 'in',
                amount: 50000,
                description: 'Sample monthly fee (dev)',
                created_at: new Date().toISOString(),
                payment_status: 'paid',
                fiscal_year: year,
                period_month: new Date().getMonth() + 1,
                processed_at: new Date().toISOString(),
                metadata: {},
              }];
              return new Response(JSON.stringify({ ok: true, data: sample }), { status: 200, headers: { 'content-type': 'application/json' } });
            }

            console.log('[api/finance/my] fallback payload prepared');
            return new Response(JSON.stringify({ ok: true, data: payload }), { status: 200, headers: { 'content-type': 'application/json' } });
          } catch (fallbackErr) {
            console.error('[api/finance/my] fallback assembly error', String(fallbackErr));
            if (process.env.NODE_ENV !== 'production') {
              const sample = [{
                transaction_id: '00000000-0000-0000-0000-000000000002',
                user_id: userId,
                category_name: 'DEV MOCK',
                category_code: 'DEV_MOCK',
                flow_type: 'in',
                amount: 10000,
                description: 'Dev fallback mock',
                created_at: new Date().toISOString(),
                payment_status: 'paid',
                fiscal_year: year,
                period_month: new Date().getMonth() + 1,
                processed_at: new Date().toISOString(),
                metadata: {},
              }];
              return new Response(JSON.stringify({ ok: true, data: sample }), { status: 200 });
            }
          }
        }

        return new Response(JSON.stringify({ ok: false, error: error }), { status: status ?? 500, headers: { 'content-type': 'application/json' } });
      }
      // Ensure a serializable response body — include a debug marker to help diagnose
      return new Response(JSON.stringify({ ok: true, data: data ?? null, _returnedAt: new Date().toISOString() }), { status: 200, headers: { 'content-type': 'application/json' } });
    } catch (err) {
      console.error('[api/finance/my] proxy error', String(err));
      const msg = err && typeof (err as Record<string, unknown>)['message'] === 'string' ? String((err as Record<string, unknown>)['message']) : String(err);
      return new Response(JSON.stringify({ ok: false, error: msg }), { status: 500 });
    }
  } catch (e: unknown) {
    console.error('[api/finance/my] error', String(e));
    const msg = e && typeof (e as Record<string, unknown>)['message'] === 'string' ? String((e as Record<string, unknown>)['message']) : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
