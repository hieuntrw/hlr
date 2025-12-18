import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import serverDebug from '@/lib/server-debug'
import ensureAdmin from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

// use shared `ensureAdmin` helper

export async function GET(request: NextRequest) {
  const start = Date.now();
  serverDebug.debug('[admin/profiles] GET start', { url: request.url });
  try {
    // Log cookies/header for diagnosis
    try {
      serverDebug.debug('[admin/profiles] request headers cookie:', request.headers.get('cookie')?.slice(0, 300));
    } catch (e) {
      serverDebug.warn('[admin/profiles] failed to read request.headers.cookie', e);
    }
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

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      serverDebug.error('SUPABASE_SERVICE_ROLE_KEY not configured');
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const service = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Optional query param `fields` to control selected columns (comma separated)
    const url = new URL(request.url);
    // Expose commonly-needed profile columns for admin UI by default.
    // Callers can still override via `?fields=` if necessary.
    // By default do not select `role` column because it may have been migrated
    // to auth.user app_metadata. Callers can request it explicitly via `?fields=`.
    const fields = url.searchParams.get('fields') || 'id,full_name,email,is_active,join_date,leave_date,gender,phone_number,dob,device_name,pb_hm_seconds,pb_fm_seconds,pb_hm_approved,pb_fm_approved,strava_id,strava_access_token,strava_refresh_token,strava_token_expires_at';

    const { data, error } = await service.from('profiles').select(fields).order('full_name', { ascending: true });
    if (error) {
      serverDebug.error('Failed to fetch profiles', error);
      serverDebug.debug('[admin/profiles] duration_ms:', Date.now() - start);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    serverDebug.debug('[admin/profiles] GET success count=', Array.isArray(data) ? data.length : 0, 'duration_ms:', Date.now() - start);
    return NextResponse.json({ data });
  } catch (err: unknown) {
    serverDebug.error('Exception in admin profiles list', err);
    serverDebug.debug('[admin/profiles] duration_ms:', Date.now() - start);
    const status = (err as Record<string, unknown>)?.status || 500;
    return NextResponse.json({ error: (err as Record<string, unknown>)?.message || String(err) }, { status: typeof status === 'number' ? status : 500 });
  }
}
