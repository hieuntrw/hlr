import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import serverDebug from '@/lib/server-debug';

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const start = Date.now();
    const cookieStore = cookies();
    // Log incoming cookie previews for diagnosis
    try {
      const incoming = cookieStore.getAll().map(c => ({ name: c.name, preview: c.value?.substring(0, 80) }));
      serverDebug.debug('[profile.me] incoming cookies:', incoming);
      serverDebug.debug('[profile.me] sb-access-token preview:', cookieStore.get('sb-access-token')?.value?.substring(0,120) || null);
      serverDebug.debug('[profile.me] sb-refresh-token preview:', cookieStore.get('sb-refresh-token')?.value?.substring(0,120) || null);
    } catch (e) {
      serverDebug.warn('[profile.me] failed to read cookie previews', e);
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

    // Try to get server-side user
    const initialGet = await supabase.auth.getUser();
    let user = initialGet.data.user;
    const error = initialGet.error;
    serverDebug.debug('[profile.me] supabase.auth.getUser returned user:', !!user, 'error:', error?.message || null);
    // If no user but cookies present, try setSession
    const acc = cookieStore.get('sb-access-token')?.value;
    const ref = cookieStore.get('sb-refresh-token')?.value;
    if (!user && acc && ref) {
      try {
        serverDebug.debug('[profile.me] attempting supabase.auth.setSession from cookies');
        const setResp = await supabase.auth.setSession({ access_token: acc, refresh_token: ref });
        serverDebug.debug('[profile.me] setSession error:', setResp.error?.message || null);
        const retry = await supabase.auth.getUser();
        // overwrite user variable for subsequent logic
        // prefer using the retry response directly
        user = retry.data.user;
        serverDebug.debug('[profile.me] retry supabase.getUser returned user:', !!user, 'error:', retry.error?.message || null);
      } catch (e: unknown) {
        serverDebug.warn('[profile.me] setSession failed', String(e));
      }
    }

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 200 });
    }

    if (!user) {
      serverDebug.debug('[profile.me] no user after setSession retry');
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

    // Reconstruct session if necessary
    const initialPatchGet = await supabase.auth.getUser();
    let user = initialPatchGet.data.user;
    const error = initialPatchGet.error;
    const acc2 = cookieStore.get('sb-access-token')?.value;
    const ref2 = cookieStore.get('sb-refresh-token')?.value;
    if (!user && acc2 && ref2) {
      try {
        await supabase.auth.setSession({ access_token: acc2, refresh_token: ref2 });
        const retry = await supabase.auth.getUser();
        user = retry.data.user;
      } catch (e: unknown) {
        serverDebug.warn('[profile.me.patch] setSession failed', String(e));
      }
    }

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 200 });
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
