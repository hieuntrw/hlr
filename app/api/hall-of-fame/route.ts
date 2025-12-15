import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import serverDebug from '@/lib/server-debug';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url) return NextResponse.json({ ok: false, error: 'Missing SUPABASE URL' }, { status: 500 });

    const client = key ? createClient(url, key) : createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

    // Attempt to fetch top 3 full marathon PBs (public data)
    const resp = await client
      .from('profiles')
      .select('id, full_name, pb_fm_seconds, pb_hm_seconds')
      .not('pb_fm_seconds', 'is', null)
      .order('pb_fm_seconds', { ascending: true })
      .limit(3);

    if (resp.error) {
      serverDebug.error('[hall-of-fame] query error', resp.error);
      return NextResponse.json({ ok: false, error: resp.error.message }, { status: 500 });
    }

    const data = (resp.data || []).map((p: unknown, idx: number) => {
      const pr = p as Record<string, unknown>;
      return {
        rank: idx + 1,
        name: typeof pr.full_name === 'string' ? pr.full_name : (pr.id as string),
        time_seconds: pr.pb_fm_seconds,
        distance: 'FM',
      };
    });

    return NextResponse.json({ ok: true, data });
  } catch (err: unknown) {
    serverDebug.error('[hall-of-fame] exception', String(err));
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
