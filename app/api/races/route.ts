import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import serverDebug from '@/lib/server-debug'

export async function GET() {
  try {
    const cookieStore = cookies();
    const hasSession = Boolean(cookieStore.get('sb-session') || cookieStore.get('sb-access-token') || cookieStore.get('sb-refresh-token'));
    if (!hasSession) {
      return NextResponse.json({ ok: false, error: 'Không xác thực' }, { status: 401 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
      serverDebug.error('Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL');
      return NextResponse.json({ ok: false, error: 'Server not configured' }, { status: 500 });
    }

    const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    const { data, error } = await service
      .from('races')
      .select('id, name, race_date, location, image_url, race_results(id)')
      .order('race_date', { ascending: false });

    if (error) {
      serverDebug.error('GET /api/races error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const mapped = (data || []).map((r: Record<string, unknown>) => ({
      id: String(r['id'] ?? ''),
      name: String(r['name'] ?? ''),
      race_date: String(r['race_date'] ?? ''),
      location: r['location'] as string | undefined,
      image_url: r['image_url'] as string | undefined,
      participant_count: Array.isArray(r['race_results']) ? (r['race_results'] as unknown[]).length : 0,
    }));

    return NextResponse.json(mapped);
  } catch (err: unknown) {
    serverDebug.error('GET /api/races exception', String(err));
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
