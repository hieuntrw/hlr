import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import serverDebug from '@/lib/server-debug'

export const dynamic = 'force-dynamic';

async function ensureAdmin(supabaseAuth: SupabaseClient) {
  const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
  if (userError || !user) throw { status: 401, message: 'Không xác thực' };

  const { data: profile } = await supabaseAuth
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const role = profile?.role;
  if (!role || !['admin', 'mod_finance', 'mod_member'].includes(role)) throw { status: 403, message: 'Không có quyền' };
  return { user, role };
}

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

    const { data, error } = await client
      .from('member_rewards')
      .select('id, status, user_id, race_result_id, reward_definition_id, related_transaction_id, profiles(full_name), reward_definitions(prize_description)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      serverDebug.error('GET member_rewards error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (err: unknown) {
    serverDebug.error('GET /api/admin/member-rewards exception', err);
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

    await ensureAdmin(supabaseAuth);

    const body = await request.json().catch(() => null);
    if (!body || !body.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const id = body.id as string;
    const updates = body.updates || { status: 'delivered' };

    const service = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
      : null;

    const client = service || supabaseAuth;

    const { data, error } = await client.from('member_rewards').update(updates).eq('id', id).select().maybeSingle();
    if (error) {
      serverDebug.error('PUT member_rewards update error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If marking delivered and there is a related transaction, attempt to mark it paid
    if ((updates as Record<string, unknown>).status === 'delivered' && data?.related_transaction_id) {
      try {
        const txnId = data.related_transaction_id;
        const now = new Date().toISOString();
        const svc = service || supabaseAuth;
        await svc.from('transactions').update({ payment_status: 'paid', paid_at: now }).eq('id', txnId);
      } catch (e) {
        serverDebug.warn('Failed to mark related transaction paid', e);
      }
    }

    return NextResponse.json({ updated: data });
  } catch (err: unknown) {
    serverDebug.error('PUT /api/admin/member-rewards exception', err);
    const status = (err as Record<string, unknown>)?.status || 500;
    return NextResponse.json({ error: (err as Record<string, unknown>)?.message || String(err) }, { status: typeof status === 'number' ? status : 500 });
  }
}
