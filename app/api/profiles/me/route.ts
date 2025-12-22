import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import serverDebug from '@/lib/server-debug'

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

    // Try to get user from auth first and reconstruct session if needed
    let user = (await supabase.auth.getUser()).data.user;

    if (!user) {
      try {
        const access = request.cookies.get('sb-access-token')?.value;
        const refresh = request.cookies.get('sb-refresh-token')?.value;
        if (access && refresh) {
          serverDebug.debug('[profiles.me] attempting supabase.auth.setSession from cookies', { access: !!access, refresh: !!refresh });
          const setResp = await supabase.auth.setSession({ access_token: access, refresh_token: refresh });
          serverDebug.debug('[profiles.me] setSession result error:', setResp.error?.message || null);
          const retry = await supabase.auth.getUser();
          user = retry.data.user || null;
        }
      } catch (e: unknown) {
        serverDebug.warn('[profiles.me] session reconstruction failed', String(e));
      }
    }

    if (!user) return NextResponse.json({ error: 'Không xác thực' }, { status: 401 });

    // Determine role: prefer app_metadata.role
    let role: string | undefined = undefined;
    // Safely read `app_metadata.role` from the user object without `any` casts
    if (user && typeof user === 'object' && 'app_metadata' in user) {
      const appMeta = (user as unknown as Record<string, unknown>)['app_metadata'];
      if (appMeta && typeof appMeta === 'object' && 'role' in (appMeta as Record<string, unknown>)) {
        const r = (appMeta as Record<string, unknown>)['role'];
        if (typeof r === 'string') role = r;
      }
    }

    // Fetch profile row
    const { data: profileRow, error: profileErr } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, total_stars')
      .eq('id', user.id)
      .maybeSingle();

    if (profileErr) {
      serverDebug.warn('[profiles.me] profiles lookup failed', profileErr.message || profileErr);
    }

    if (!role && profileRow && typeof profileRow === 'object' && 'role' in profileRow) {
      const r = (profileRow as unknown as Record<string, unknown>)['role'];
      if (typeof r === 'string') role = r;
    }

    const result = {
      id: user.id,
      full_name: profileRow?.full_name || (user.email || null),
      avatar_url: profileRow?.avatar_url || null,
      total_stars: profileRow?.total_stars ?? 0,
      role: role || null,
    };

    // Return canonical shape matching /api/profile/me: include ok flag for consistency
    return NextResponse.json({ ok: true, profile: result });
  } catch (err: unknown) {
    serverDebug.error('[profiles.me] exception', String(err));
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
