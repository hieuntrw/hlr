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

    // Fetch all profiles that have a PB in FM or HM and return flattened entries
    const resp = await client
      .from('profiles')
      .select('id, full_name, gender, pb_fm_seconds, pb_hm_seconds')
      .or('pb_fm_seconds.not.is.null,pb_hm_seconds.not.is.null')
      .limit(1000);

    if (resp.error) {
      serverDebug.error('[hall-of-fame] query error', resp.error);
      return NextResponse.json({ ok: false, error: resp.error.message }, { status: 500 });
    }

    const rows = (resp.data || []) as Record<string, unknown>[];
    // Flatten into distance-specific entries (FM and HM), include gender when available
    const entries: Array<Record<string, unknown>> = [];
    for (const pr of rows) {
      const id = String(pr.id ?? '');
      const name = typeof pr.full_name === 'string' ? pr.full_name : id;
      const gender = typeof pr.gender === 'string' ? pr.gender : undefined;
      const fm = pr.pb_fm_seconds ?? null;
      const hm = pr.pb_hm_seconds ?? null;
      if (fm !== null && fm !== undefined) {
        entries.push({ id, name, time_seconds: Number(fm), distance: 'FM', gender });
      }
      if (hm !== null && hm !== undefined) {
        entries.push({ id, name, time_seconds: Number(hm), distance: 'HM', gender });
      }
    }

    // Sort by time ascending (better times first) and assign rank
    entries.sort((a, b) => Number(a.time_seconds ?? Infinity) - Number(b.time_seconds ?? Infinity));
    const data = entries.map((e, idx) => ({ rank: idx + 1, ...e }));

    return NextResponse.json({ ok: true, data });
  } catch (err: unknown) {
    serverDebug.error('[hall-of-fame] exception', String(err));
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
