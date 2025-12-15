import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import serverDebug from '@/lib/server-debug';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    if (!url) return NextResponse.json({ ok: false, error: 'Missing SUPABASE URL' }, { status: 500 });

    const keyName = request.nextUrl.searchParams.get('key');
    if (!keyName) return NextResponse.json({ ok: false, error: 'Missing key param' }, { status: 400 });

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    const client = serviceKey ? createClient(url, serviceKey) : createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

    const { data, error } = await client.from('system_settings').select('value').eq('key', keyName).maybeSingle();
    if (error) {
      serverDebug.error('[system-settings] query error', error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, value: data?.value ?? null });
  } catch (err: unknown) {
    serverDebug.error('[system-settings] exception', String(err));
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
