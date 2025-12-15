import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import serverDebug from '@/lib/server-debug';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    if (!url) return NextResponse.json({ ok: false, error: 'Missing SUPABASE URL' }, { status: 500 });

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    const client = serviceKey ? createClient(url, serviceKey) : createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

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
