import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import serverDebug from '@/lib/server-debug';

export const dynamic = 'force-dynamic';

let ORDER_COLUMN: string | null = null;

async function probeOrderColumn() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return;
    const admin = createClient(url, key);

    let resp = await admin.from('member_rewards').select('awarded_date').limit(1).maybeSingle();
    if (!resp.error) {
      ORDER_COLUMN = 'awarded_date';
      return;
    }

    resp = await admin.from('member_rewards').select('awarded_at').limit(1).maybeSingle();
    if (!resp.error) {
      ORDER_COLUMN = 'awarded_at';
      return;
    }
  } catch (e) {
    serverDebug.debug('[profile.rewards] probeOrderColumn failed', String(e));
  }
}

probeOrderColumn();

export async function GET() {
  const start = Date.now();
  try {
    const cookieStore = cookies();

    try {
      const incoming = cookieStore.getAll().map((c) => ({ name: c.name, preview: c.value?.substring(0, 20) }));
      serverDebug.debug('[profile.rewards] incoming cookies:', incoming);
    } catch (e) {
      serverDebug.debug('[profile.rewards] failed to read cookie previews', String(e));
    }

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set() {},
          remove() {},
        },
      }
    );

    const initial = await supabase.auth.getUser();
    let user = initial.data.user;
    let error: unknown = initial.error;

    const acc = cookieStore.get('sb-access-token')?.value;
    const ref = cookieStore.get('sb-refresh-token')?.value;
    if (!user && (acc || ref)) {
      try {
        if (acc && ref) {
          await supabase.auth.setSession({ access_token: acc, refresh_token: ref });
          const retry = await supabase.auth.getUser();
          user = retry.data.user;
          error = retry.error;
        } else {
          serverDebug.debug('[profile.rewards] incomplete auth cookies; skipping setSession');
        }
      } catch (e: unknown) {
        serverDebug.debug('[profile.rewards] setSession failed', String(e));
      }
    }

    if (error) {
      const msg = (error as { message?: string }).message ?? String(error);
      return NextResponse.json({ ok: false, error: msg }, { status: 200 });
    }
    if (!user) return NextResponse.json({ ok: false, error: 'No user' }, { status: 401 });

    const tryOrderCols = ORDER_COLUMN ? [ORDER_COLUMN] : ['awarded_date', 'awarded_at'];

    for (const col of tryOrderCols) {
      try {
        const rewardsResp = await supabase
          .from('member_rewards')
          .select('*')
          .eq('user_id', user.id)
          .order(col as string, { ascending: false });

        if (!rewardsResp.error) {
          ORDER_COLUMN = col;
          return NextResponse.json({ ok: true, data: rewardsResp.data });
        }

        serverDebug.debug('[profile.rewards] query error for col', col, rewardsResp.error?.message || rewardsResp.error);
      } catch (e: unknown) {
        serverDebug.debug('[profile.rewards] exception while querying with order', col, String(e));
      }
    }

    try {
      const fallback = await supabase.from('member_rewards').select('*').eq('user_id', user.id);
      if (!fallback.error) return NextResponse.json({ ok: true, data: fallback.data });
      serverDebug.error('[profile.rewards] final fallback failed', fallback.error);
      return NextResponse.json({ ok: false, error: fallback.error.message }, { status: 500 });
    } catch (e: unknown) {
      serverDebug.error('[profile.rewards] final fallback exception', String(e));
      const message = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
  } catch (err: unknown) {
    serverDebug.error('[profile.rewards] exception', String(err));
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  } finally {
    serverDebug.debug('[profile.rewards] duration_ms:', Date.now() - start);
  }
}
