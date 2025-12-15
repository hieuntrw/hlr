import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import serverDebug from '@/lib/server-debug';
import ensureAdmin from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

// use shared `ensureAdmin` helper

export async function GET(request: NextRequest) {
  try {
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set() {},
          remove() {},
        },
      }
    );

    await ensureAdmin(supabaseAuth);

    const service = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
      : null;

    const client = service || supabaseAuth;

    const url = new URL(request.url);
    const type = url.searchParams.get('type');

    let q = client.from('transactions').select('id, user_id, type, amount, description, transaction_date, payment_status, profiles(full_name), receipt_url, paid_by, paid_at, rejected_by, rejected_at, rejection_reason').order('transaction_date', { ascending: false });
    if (type) q = q.eq('type', type);

    const { data, error } = await q;
    if (error) {
      serverDebug.error('GET transactions error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const transactions = (data || []).map((t) => {
      const tRec = t as Record<string, unknown>;
      return {
        id: tRec.id,
        user_id: tRec.user_id,
        type: tRec.type,
        amount: tRec.amount,
        description: tRec.description,
        transaction_date: tRec.transaction_date,
        payment_status: tRec.payment_status,
        profile: tRec.profiles,
        receipt_url: tRec.receipt_url,
        paid_by: tRec.paid_by,
        paid_at: tRec.paid_at,
        rejected_by: tRec.rejected_by,
        rejected_at: tRec.rejected_at,
        rejection_reason: tRec.rejection_reason,
      } as Record<string, unknown>;
    });

    return NextResponse.json({ transactions });
  } catch (err: unknown) {
    serverDebug.error('GET /api/admin/transactions exception', err);
    const status = (err as Record<string, unknown>)?.status || 500;
    return NextResponse.json({ error: (err as Record<string, unknown>)?.message || String(err) }, { status: typeof status === 'number' ? status : 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set() {},
          remove() {},
        },
      }
    );

    const { user } = await ensureAdmin(supabaseAuth);

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || !body.id || !body.action) return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });

    const id = String(body.id);
    const action = String(body.action);

    const service = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
      : null;

    const client = service || supabaseAuth;

    if (action === 'approve') {
      const updates: Record<string, unknown> = { payment_status: 'paid', paid_by: user.id, paid_at: new Date().toISOString() };
      const { data, error } = await client.from('transactions').update(updates).eq('id', id).select().maybeSingle();
      if (error) {
        serverDebug.error('Approve transaction error', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ updated: data });
    } else if (action === 'reject') {
      const reason = body.reason || null;
      const updates: Record<string, unknown> = { payment_status: 'rejected', rejected_by: user.id, rejected_at: new Date().toISOString(), rejection_reason: reason };
      const { data, error } = await client.from('transactions').update(updates).eq('id', id).select().maybeSingle();
      if (error) {
        serverDebug.error('Reject transaction error', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ updated: data });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: unknown) {
    serverDebug.error('PUT /api/admin/transactions exception', err);
    const status = (err as Record<string, unknown>)?.status || 500;
    return NextResponse.json({ error: (err as Record<string, unknown>)?.message || String(err) }, { status: typeof status === 'number' ? status : 500 });
  }
}
