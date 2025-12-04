import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { syncUserActivitiesForCurrentMonth } from '@/lib/services/stravaService';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Basic protection: require internal secret header
    const secret = request.headers.get('x-internal-secret');
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Find profiles with Strava connection
    const { data: profiles, error: profilesErr } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .not('strava_id', 'is', null)
      .is('is_active', true);

    if (profilesErr) {
      console.error('[cron/strava-sync] Failed to load profiles:', profilesErr);
      return NextResponse.json({ error: 'Failed to load profiles' }, { status: 500 });
    }

    const results: any[] = [];

    for (const p of profiles || []) {
      try {
        const res = await syncUserActivitiesForCurrentMonth(p.id);
        results.push({ user_id: p.id, success: true, result: res });
      } catch (err: any) {
        console.error(`[cron/strava-sync] Failed for user ${p.id}:`, err);
        results.push({ user_id: p.id, success: false, error: err?.message || String(err) });
      }
    }

    return NextResponse.json({ success: true, processed: results.length, results });
  } catch (err: any) {
    console.error('[cron/strava-sync] Exception:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
