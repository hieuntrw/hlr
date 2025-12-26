import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import serverDebug from '@/lib/server-debug';
import { requireAdminFromRequest } from '@/lib/admin-auth';

// Local types to avoid using `any` across this file
type ErrorShape = { code?: string; message?: string } | null;
type ApiResult<T = unknown> = { data: T | T[] | null; error?: ErrorShape };

// When running against self-hosted PostgREST the `member_star_awards` table
// may be restricted; avoid logging the same informational message repeatedly
// by tracking whether we've already reported restricted access in this process.
let starAccessRestrictedLogged = false;

export const dynamic = 'force-dynamic';

// === OVERVIEW ===
// This file implements two exported handlers used by the admin `reward-monitor` UI.
// Requirements implemented:
// 1) Load all 4 tabs' data (milestone, podium, lucky, star) sorted by `created_at`.
// 2) Provide actions to deliver a single row or bulk rows.
// 3) When delivering, update `status` -> 'delivered', set `delivered_at` and `user_id` (current user).
//    Create a `transactions` row with `payment_status = 'paid'` when a cash amount exists
//    (applies to `member_milestone_rewards` and `member_podium_rewards`).

// Keep function names `GET` and `PUT` unchanged.

function supabaseServerClient(request: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    serverDebug.error('SUPABASE_SERVICE_ROLE_KEY not configured');
    // fall back to anon key if service role not configured to avoid hard failure in some environments
    return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    });
  }

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set() {},
      remove() {},
    },
  });
}

export async function GET(request: NextRequest) {
  // Load all four tables required by reward-monitor in a simple, deterministic way.
  try {
    const supabaseAuth = supabaseServerClient(request);
    // ensure admin/mod_finance via centralized helper
    const { user } = await requireAdminFromRequest((name: string) => request.cookies.get(name)?.value);

    // Prefer service role client when available for full visibility; otherwise use authenticated client
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
      : null;
    const client = service || supabaseAuth;

    serverDebug.info('GET member-rewards: loading all tabs', { user: user?.id ?? null, hasService: !!service });

    // Resilient fetch helper: prefer ordering by `created_at`, but fall back to a plain
    // select if the column is missing or ordering fails. Returns { data, error } shape.
    async function fetchWithOrderFallback(table: string): Promise<ApiResult> {
      try {
        // If service role is available, call PostgREST directly with no-cache to avoid Next's fetch cache
        if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
          try {
            const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
            const url = `${base}/rest/v1/${table}?select=${encodeURIComponent('*')}&order=created_at.desc&limit=10000`;
            const res = await fetch(url, {
              headers: {
                Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
                apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
              },
              cache: 'no-store'
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
              serverDebug.warn('GET member-rewards: direct REST fetch failed', { table, status: res.status, statusText: res.statusText, url });
              return { error: { message: res.statusText }, data: null };
            }
            return { data } as ApiResult;
          } catch (e) {
            serverDebug.warn('GET member-rewards: direct REST fetch threw', { table, error: String(e) });
            // fall through to client-based fetch below
          }
        }

        // Add a generous limit to avoid any unexpected implicit limits from clients
        const res = await client.from(table).select('*').order('created_at', { ascending: false }).limit(10000) as ApiResult;
        if (res.error) {
          const msg = String((res.error || {}).message || '');
          // Column missing or other ordering-related errors often surface here.
          if (/column .*created_at.*does not exist/i.test(msg) || /invalid.*order/i.test(msg)) {
            serverDebug.info('GET member-rewards: ordering by created_at failed, retrying without order', { table, message: msg });
            const retry = await client.from(table).select('*').limit(10000) as ApiResult;
            return retry;
          }
        }
        // Defensive: if data is a single object (unexpected), log it for debugging
        try {
          const maybeData = (res as ApiResult).data;
          if (maybeData && !Array.isArray(maybeData)) {
            serverDebug.warn('GET member-rewards: select returned non-array data', { table, sample: maybeData });
          }
        } catch {
          /* ignore logging errors */
        }
        return res as ApiResult;
      } catch (err) {
        serverDebug.warn('GET member-rewards: fetchWithOrderFallback threw', { table, error: String(err) });
        return { error: { message: String(err) }, data: null };
      }
    }

    // Fetch primary tables in parallel using the helper (include stars)
    // For member_milestone_rewards we want joined fields (profiles, reward_milestones, races)
    async function fetchMemberMilestonesWithJoins(): Promise<ApiResult> {
      try {
        const selectStr = `id,member_id,race_id,race_result_id,status,achieved_time_seconds,reward_description,cash_amount,related_transaction_id,created_at,profiles!member_milestone_rewards_member_id_fkey(full_name,email),reward_milestones(id,milestone_name,race_type,reward_description),races(id,name)`;
        // If service role is available, call PostgREST directly with no-cache to avoid Next fetch caching
        if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
          try {
            const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
            const url = `${base}/rest/v1/member_milestone_rewards?select=${encodeURIComponent(selectStr)}&order=created_at.desc&limit=10000`;
            const res = await fetch(url, {
              headers: {
                Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
                apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
              },
              cache: 'no-store'
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
              serverDebug.warn('GET member-rewards: direct REST fetch failed for milestones', { status: res.status, statusText: res.statusText, url });
              return { error: { message: res.statusText }, data: null };
            }
            return { data } as ApiResult;
          } catch (e) {
            serverDebug.warn('GET member-rewards: direct REST fetch threw for milestones', { error: String(e) });
            // fall back to client-based fetch below
          }
        }

        const res = await client.from('member_milestone_rewards').select(selectStr).order('created_at', { ascending: false }).limit(10000) as ApiResult;
        if (res.error) {
          const msg = String((res.error || {}).message || '');
          if (/column .*created_at.*does not exist/i.test(msg) || /invalid.*order/i.test(msg)) {
            serverDebug.info('GET member-rewards: milestone ordering failed, retrying without order', { message: msg });
            const retry = await client.from('member_milestone_rewards').select(selectStr).limit(10000) as ApiResult;
            return retry;
          }
        }
        try {
          const maybeData = (res as ApiResult).data;
          if (maybeData && !Array.isArray(maybeData)) {
            serverDebug.warn('GET member-rewards: member_milestone_rewards select returned non-array data', { sample: maybeData });
          }
        } catch {}
        return res as ApiResult;
      } catch (err) {
        serverDebug.warn('GET member-rewards: fetchMemberMilestonesWithJoins threw', { error: String(err) });
        return { error: { message: String(err) }, data: null };
      }
    }

    const [mmRes, prRes, lwRes, stRes] = await Promise.all([
      fetchMemberMilestonesWithJoins(),
      fetchWithOrderFallback('member_podium_rewards'),
      fetchWithOrderFallback('lucky_draw_winners'),
      fetchWithOrderFallback('member_star_awards'),
    ]) as ApiResult[];

    // Log counts for visibility
    try {
      serverDebug.info('GET member-rewards: table counts', {
        member_milestone_rewards: Array.isArray(mmRes.data) ? mmRes.data.length : null,
        member_podium_rewards: Array.isArray(prRes.data) ? prRes.data.length : null,
        lucky_draw_winners: Array.isArray(lwRes.data) ? lwRes.data.length : null,
        member_star_awards: Array.isArray(stRes.data) ? stRes.data.length : null,
      });
    } catch (err) {
      serverDebug.warn('GET member-rewards: failed to log table counts', { error: String(err) });
    }

    // `stRes` is fetched in parallel above. It may contain a permission error
    // on self-hosted PostgREST (42501) which is handled below.

    // Normalize errors: log and set empty arrays on permission/table errors
    function safeData(res: ApiResult | null, table: string) {
      if (!res) return [];
      if (res.error) {
        serverDebug.warn('GET member-rewards: table select error', { table, error: res.error });
        const code = String((res.error || {}).code || '');
        if (code === '42501' || code === '42P01') return [];
        return [];
      }
      return Array.isArray(res.data) ? res.data : (res.data ? [res.data] : []);
    }

    const milestones = safeData(mmRes, 'member_milestone_rewards');
    const podiums = safeData(prRes, 'member_podium_rewards');
    const lucky = safeData(lwRes, 'lucky_draw_winners');
    const stars = safeData(stRes, 'member_star_awards');

    // Log a sample milestone row for debugging frontend mapping if available
    try {
      if (Array.isArray(milestones) && milestones.length > 0) {
        serverDebug.info('GET member-rewards: sample milestone row', { sample: milestones[0] });
      }
    } catch {
      /* ignore */
    }

    // Logging for star table: if permission denied, log a single informational message;
    // if another error occurred, log a warning. If stars now return data and we had
    // previously logged restricted access, clear the flag.
    if (stRes && stRes.error) {
      const code = String((stRes.error || {}).code || '');
      if (code === '42501' || code === '42P01') {
        if (!starAccessRestrictedLogged) {
          serverDebug.info('GET member-rewards: member_star_awards access restricted; returning empty list', { code });
          starAccessRestrictedLogged = true;
        }
      } else {
        serverDebug.warn('GET member-rewards: member_star_awards select error', { error: stRes.error });
      }
    } else if (stRes && Array.isArray(stRes.data)) {
      if (starAccessRestrictedLogged && stRes.data.length > 0) starAccessRestrictedLogged = false;
    }

    return NextResponse.json({ milestones, podiums, lucky, stars });
  } catch (err: unknown) {
    serverDebug.error('GET /api/admin/member-rewards exception', err);
    const status = (err as unknown as { status?: number })?.status ?? 500;
    const message = (err as unknown as { message?: string })?.message ?? String(err);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(request: NextRequest) {
  // Deliver single or multiple reward rows.
  try {
    const supabaseAuth = supabaseServerClient(request);
    const { user } = await requireAdminFromRequest((name: string) => request.cookies.get(name)?.value);

    const service = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
      : null;
    const client = service || supabaseAuth;

    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Missing body' }, { status: 400 });

    const ids: string[] = Array.isArray(body.ids) ? body.ids.map(String) : (body.id ? [String(body.id)] : []);
    if (ids.length === 0) return NextResponse.json({ error: 'Missing id(s)' }, { status: 400 });

    const delivered_at = new Date().toISOString();
    const user_id = user?.id ?? null;

    const results: Array<Record<string, unknown>> = [];

    // Helper: attempt to find row in each table, create transaction if necessary, then update
    async function deliverOne(targetId: string) {
      // 1) member_milestone_rewards
      const mm = await client.from('member_milestone_rewards').select('*').eq('id', targetId).maybeSingle() as ApiResult;
      if (!mm.error && mm.data) {
        const row = mm.data as Record<string, unknown>;
        let txnId: string | null = null;
        const cash = Number((row['cash_amount'] as unknown) ?? 0);
        if (cash > 0) {
          const tx = await client.from('transactions').insert({
            user_id: (row['member_id'] ?? row['user_id']) as unknown,
            type: 'reward_payout',
            amount: cash,
            description: `Milestone payout: ${String(row['reward_description'] ?? '')}`,
            transaction_date: new Date().toISOString().slice(0, 10),
            payment_status: 'paid',
          }).select('id').maybeSingle() as ApiResult;
          if (!tx.error && tx.data) {
            const idVal = (tx.data as Record<string, unknown>)?.id;
            txnId = idVal != null ? String(idVal) : null;
          }
          if (tx.error) serverDebug.warn('Failed to insert transaction for milestone', { error: tx.error });
        }
        const payload: Record<string, unknown> = { status: 'delivered', delivered_at, user_id};
        if (txnId) payload['related_transaction_id'] = txnId;
        const upd = await client.from('member_milestone_rewards').update(payload).eq('id', targetId).select().maybeSingle() as ApiResult;
        if (upd.error) {
          serverDebug.error('Failed updating member_milestone_rewards', { id: targetId, err: upd.error });
          return { id: targetId, table: 'member_milestone_rewards', error: String(upd.error) };
        }
        return { id: targetId, table: 'member_milestone_rewards', updated: upd.data };
      }

      // 2) member_podium_rewards (create transaction if cash present)
      const pr = await client.from('member_podium_rewards').select('*').eq('id', targetId).maybeSingle() as ApiResult;
      if (!pr.error && pr.data) {
        const row = pr.data as Record<string, unknown>;
        let txnId: string | null = null;
        const cash = Number((row['cash_amount'] as unknown) ?? 0);
        if (cash > 0) {
          const tx = await client.from('transactions').insert({
            user_id: (row['member_id'] ?? row['user_id']) as unknown,
            type: 'reward_payout',
            amount: cash,
            description: `Podium payout: ${String(row['reward_description'] ?? '')}`,
            transaction_date: new Date().toISOString().slice(0, 10),
            payment_status: 'paid',
          }).select('id').maybeSingle() as ApiResult;
          if (!tx.error && tx.data) {
            const idVal = (tx.data as Record<string, unknown>)?.id;
            txnId = idVal != null ? String(idVal) : null;
          }
          if (tx.error) serverDebug.warn('Failed to insert transaction for podium', { error: tx.error });
        }
        const payload: Record<string, unknown> = { status: 'delivered', delivered_at, user_id};
        if (txnId) payload['related_transaction_id'] = txnId;
        const upd = await client.from('member_podium_rewards').update(payload).eq('id', targetId).select().maybeSingle() as ApiResult;
        if (upd.error) {
          serverDebug.error('Failed updating member_podium_rewards', { id: targetId, err: upd.error });
          return { id: targetId, table: 'member_podium_rewards', error: String(upd.error) };
        }
        return { id: targetId, table: 'member_podium_rewards', updated: upd.data };
      }

      // 3) lucky_draw_winners (update status delivered, create txn if cash_amount present)
      const lw = await client.from('lucky_draw_winners').select('*').eq('id', targetId).maybeSingle() as ApiResult;
      if (!lw.error && lw.data) {
        const row = lw.data as Record<string, unknown>;
        let txnId: string | null = null;
        const cash = Number((row['cash_amount'] as unknown) ?? 0);
        if (cash > 0) {
          const tx = await client.from('transactions').insert({
            user_id: (row['member_id'] ?? row['user_id']) as unknown,
            type: 'reward_payout',
            amount: cash,
            description: `Lucky draw payout: ${String(row['reward_description'] ?? '')}`,
            transaction_date: new Date().toISOString().slice(0, 10),
            payment_status: 'paid',
          }).select('id').maybeSingle() as ApiResult;
          if (!tx.error && tx.data) {
            const idVal = (tx.data as Record<string, unknown>)?.id;
            txnId = idVal != null ? String(idVal) : null;
          }
          if (tx.error) serverDebug.warn('Failed to insert transaction for lucky draw', { error: tx.error });
        }
        const payload: Record<string, unknown> = { status: 'delivered', delivered_at, user_id };
        if (txnId) payload['related_transaction_id'] = txnId;
        const upd = await client.from('lucky_draw_winners').update(payload).eq('id', targetId).select().maybeSingle() as ApiResult;
        if (upd.error) {
          serverDebug.error('Failed updating lucky_draw_winners', { id: targetId, err: upd.error });
          return { id: targetId, table: 'lucky_draw_winners', error: String(upd.error) };
        }
        return { id: targetId, table: 'lucky_draw_winners', updated: upd.data };
      }

      // 4) member_star_awards (no transaction expected)
      const st = await client.from('member_star_awards').select('*').eq('id', targetId).maybeSingle() as ApiResult;
      if (!st.error && st.data) {
        const payload: Record<string, unknown> = { status: 'delivered', delivered_at, user_id };
        const upd = await client.from('member_star_awards').update(payload).eq('id', targetId).select().maybeSingle() as ApiResult;
        if (upd.error) {
          serverDebug.error('Failed updating member_star_awards', { id: targetId, err: upd.error });
          return { id: targetId, table: 'member_star_awards', error: String(upd.error) };
        }
        return { id: targetId, table: 'member_star_awards', updated: upd.data };
      }

      return { id: targetId, error: 'Not found in any reward table' };
    }

    for (const i of ids) {
      try {
        // sequential to avoid accidental duplicate transactions
        // eslint-disable-next-line no-await-in-loop
        const res = await deliverOne(i);
        results.push(res as Record<string, unknown>);
      } catch (e) {
        serverDebug.error('Error delivering id', { id: i, err: e });
        results.push({ id: i, error: String(e) });
      }
    }

    return NextResponse.json({ results });
  } catch (err: unknown) {
    serverDebug.error('PUT /api/admin/member-rewards exception', err);
    const status = (err as unknown as { status?: number })?.status ?? 500;
    const message = (err as unknown as { message?: string })?.message ?? String(err);
    return NextResponse.json({ error: message }, { status });
  }
}

