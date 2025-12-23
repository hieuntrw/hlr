import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import serverDebug from '@/lib/server-debug'

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const daysParam = Number(url.searchParams.get('days') || '30');
    const days = isNaN(daysParam) ? 30 : Math.max(1, daysParam);

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get(name: string) { return request.cookies.get(name)?.value; }, set() {}, remove() {} } }
    );

    // Reconstruct session/user using the shared helper
    const { getUserFromAuthClient } = await import('@/lib/server-auth');
    const user = await getUserFromAuthClient(supabase, (name: string) => request.cookies.get(name)?.value);
    if (!user) return NextResponse.json({ ok: false, error: 'Auth session missing!' }, { status: 401 });

    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data, error } = await supabase
      .from('activities')
      .select('id, name, distance, moving_time, elapsed_time, average_heartrate, average_cadence, total_elevation_gain, start_date, type, map_summary_polyline')
      .eq('user_id', user.id)
      .gte('start_date', since.toISOString())
      .order('start_date', { ascending: false });

    if (error) {
      serverDebug.error('GET /api/profile/activities error', error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (err: unknown) {
    serverDebug.error('GET /api/profile/activities exception', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
