import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import serverDebug from '@/lib/server-debug';

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const start = Date.now();
    const cookieStore = cookies();
    // Log incoming cookie names only (never log token values in production)
    try {
      const cookieNames = cookieStore.getAll().map(c => c.name);
      serverDebug.debug('[profile.me] incoming cookie names:', cookieNames);
      serverDebug.debug('[profile.me] sb-access-token present:', !!cookieStore.get('sb-access-token')?.value);
      serverDebug.debug('[profile.me] sb-refresh-token present:', !!cookieStore.get('sb-refresh-token')?.value);
    } catch (e) {
      serverDebug.warn('[profile.me] failed to read cookie info', e);
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

    // Reconstruct session/user using shared helper (handles sb-session fallback)
    const { getUserFromAuthClient } = await import('@/lib/server-auth');
    const user = await getUserFromAuthClient(supabase, (name: string) => cookieStore.get(name)?.value);
    if (!user) {
      serverDebug.debug('[profile.me] no user after reconstruction');
      return NextResponse.json({ ok: false, error: 'No user' }, { status: 401 });
    }

    // Fetch profiles row server-side (service context via cookies)
    const profileResp = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (profileResp.error) {
      return NextResponse.json({ ok: false, error: profileResp.error.message }, { status: 500 });
    }

    serverDebug.debug('[profile.me] returning profile success duration_ms:', Date.now() - start);
    return NextResponse.json({ ok: true, user, profile: profileResp.data });
    } catch (err: unknown) {
      serverDebug.error('[profile.me] exception', String(err));
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
  try {
    const cookieStore = cookies();
    const rawBody = await request.json().catch(() => null) as unknown;
    if (!rawBody) return NextResponse.json({ ok: false, error: 'Missing body' }, { status: 400 });
    const body = (typeof rawBody === 'object' && rawBody) ? rawBody as Record<string, unknown> : {};

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

    // Reconstruct session/user using shared helper
    const { getUserFromAuthClient } = await import('@/lib/server-auth');
    const user = await getUserFromAuthClient(supabase, (name: string) => cookieStore.get(name)?.value);
    if (!user) return NextResponse.json({ ok: false, error: 'No user' }, { status: 401 });

    // Whitelist updatable fields from client
    const allowedFields = [
      'phone_number',
      'dob',
      'device_name',
      'pb_hm_seconds',
      'pb_fm_seconds',
      'pb_hm_approved',
      'pb_fm_approved',
    ];

    const updates: Record<string, unknown> = {};
    for (const k of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(body, k)) updates[k] = body[k];
    }

    // Special action: disconnect Strava when client sends { disconnectStrava: true }
    if (body.disconnectStrava) {
      updates.strava_id = null;
      updates.strava_athlete_name = null;
      updates.strava_access_token = null;
      updates.strava_refresh_token = null;
      updates.strava_token_expires_at = null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ ok: false, error: 'No updatable fields provided' }, { status: 400 });
    }

    const resp = await supabase.from('profiles').update(updates).eq('id', user.id).select().maybeSingle();

    if (resp.error) {
      serverDebug.error('[profile.me.patch] update error', resp.error);
      return NextResponse.json({ ok: false, error: resp.error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, profile: resp.data });
  } catch (err: unknown) {
    serverDebug.error('[profile.me.patch] exception', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
