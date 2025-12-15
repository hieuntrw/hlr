import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import serverDebug from '@/lib/server-debug';


export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    if (!url) return NextResponse.json({ ok: false, error: 'Missing SUPABASE URL' }, { status: 500 });

    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    const client = key ? createClient(url, key) : createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

    const { data, error } = await client.from('system_theme_settings').select('*').maybeSingle();
    if (error) {
      serverDebug.error('[system-theme-settings] query error', error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data: data ?? null });
  } catch (err: unknown) {
    serverDebug.error('[system-theme-settings] exception', String(err));
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
