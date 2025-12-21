import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import serverDebug from '@/lib/server-debug';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient(
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

    // Reconstruct session if needed
    let user = (await supabase.auth.getUser()).data.user;
    if (!user) {
      try {
        const acc = request.cookies.get('sb-access-token')?.value;
        const ref = request.cookies.get('sb-refresh-token')?.value;
        if (acc && ref) {
          await supabase.auth.setSession({ access_token: acc, refresh_token: ref });
          user = (await supabase.auth.getUser()).data.user;
        }
      } catch (e: unknown) {
        serverDebug.warn('[profile.transactions] session reconstruction failed', String(e));
      }
    }

    if (!user) return NextResponse.json({ ok: false, error: 'Không xác thực' }, { status: 401 });

    // Use service-role client for transactions query to avoid evaluation of
    // legacy RLS policies that reference `profiles.role` in the database.
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
      : null;
    const client = service || supabase;

    const { data, error } = await client
      .from('transactions')
      .select('id, category_id, amount, payment_status, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      serverDebug.error('[profile.transactions] query error', error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    // Summarize basic balances for dashboard convenience
    let balance = 0;
    let unpaidFees = 0;
    let unpaidFines = 0;
    (data || []).forEach((t: unknown) => {
      const tr = t as Record<string, unknown>;
      const st = tr.payment_status as string | undefined;
      const amount = Number(tr.amount ?? 0);
      const type = tr.type as string | undefined;
      if (st === 'approved') {
        if (type === 'collection') balance += amount;
        else if (type === 'expense' || type === 'reward') balance -= amount;
      }
      if (st === 'pending') {
        if (type === 'collection') unpaidFees += amount;
        else if (type === 'fine') unpaidFines += amount;
      }
    });

    return NextResponse.json({ ok: true, data, summary: { balance, unpaidFees, unpaidFines } });
  } catch (err: unknown) {
    serverDebug.error('[profile.transactions] exception', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
