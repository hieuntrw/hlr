import { NextResponse } from 'next/server';
import serverDebug from '@/lib/server-debug';
import { cookies } from 'next/headers';
import getSupabaseServiceClient from '@/lib/supabase-service-client';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    // Require session cookie presence before using service-role queries
    const cookieStore = cookies();
    const hasAuth = Boolean(cookieStore.get('sb-access-token') || cookieStore.get('sb-session') || cookieStore.get('sb-refresh-token'));
    if (!hasAuth) return NextResponse.json({ ok: false, error: 'Không xác thực' }, { status: 401 });

    // Use service role client for server-side queries
    let client;
    try {
      client = getSupabaseServiceClient();
    } catch (e) {
      serverDebug.error('[profiles.id] missing service role config', String(e));
      return NextResponse.json({ ok: false, error: 'Server misconfiguration' }, { status: 500 });
    }

    const { data, error } = await client.from('profiles').select('id, full_name').eq('id', params.id).maybeSingle();
    if (error) {
      serverDebug.error('[profiles.id] query error', error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    if (!data) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true, profile: data });
  } catch (err: unknown) {
    serverDebug.error('[profiles.id] exception', String(err));
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
