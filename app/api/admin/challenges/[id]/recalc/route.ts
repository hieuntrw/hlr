import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

async function ensureAdmin(supabaseAuth: any) {
  const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
  if (userError || !user) throw { status: 401, message: 'Không xác thực' };

  const role = (user as any).user_metadata?.role as string | undefined;
  if (!role || role !== 'admin') throw { status: 403, message: 'Không có quyền' };

  return user;
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const challengeId = params.id;
    if (!challengeId) return NextResponse.json({ error: 'Missing challenge id' }, { status: 400 });

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
      console.error('SUPABASE_SERVICE_ROLE_KEY not configured');
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const service = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Optional body to limit to a single participant
    const body = await request.json().catch(() => ({}));
    const participantId = body?.participant_id as string | undefined;

    // Fetch participants for the challenge (or single participant if provided)
    let partsQuery = service.from('challenge_participants').select('id,user_id,target_km').eq('challenge_id', challengeId);
    if (participantId) partsQuery = service.from('challenge_participants').select('id,user_id,target_km').eq('id', participantId).eq('challenge_id', challengeId);

    const { data: parts, error: partErr } = await partsQuery;
    if (partErr) {
      console.error('Failed to fetch participants', partErr);
      return NextResponse.json({ error: partErr.message }, { status: 500 });
    }

    const participantIds = (parts || []).map((p: any) => p.id).filter(Boolean);
    if (participantIds.length === 0) {
      return NextResponse.json({ ok: true, message: 'No participants found', updated: [] });
    }

    // Fetch activities for these participants
    const { data: acts, error: actErr } = await service
      .from('activities')
      .select('challenge_participant_id,distance,moving_time')
      .in('challenge_participant_id', participantIds);

    if (actErr) {
      console.error('Failed to fetch activities', actErr);
      return NextResponse.json({ error: actErr.message }, { status: 500 });
    }

    // Aggregate in JS
    const byPart: Record<string, { totalMeters: number; totalSeconds: number; count: number }> = {};
    (acts || []).forEach((a: any) => {
      const pid = a.challenge_participant_id;
      if (!pid) return;
      if (!byPart[pid]) byPart[pid] = { totalMeters: 0, totalSeconds: 0, count: 0 };
      byPart[pid].totalMeters += Number(a.distance || 0);
      byPart[pid].totalSeconds += Number(a.moving_time || 0);
      byPart[pid].count += 1;
    });

    const updates: any[] = [];
    for (const p of (parts || [])) {
      const pid = p.id;
      const agg = byPart[pid] || { totalMeters: 0, totalSeconds: 0, count: 0 };
      const totalKm = Math.round((agg.totalMeters / 1000) * 100) / 100;
      const avgPaceSeconds = totalKm > 0 ? Math.round(agg.totalSeconds / totalKm) : null;
      const validActivitiesCount = agg.count;
      const completionRate = p.target_km ? Math.round((totalKm / Number(p.target_km)) * 10000) / 100 : 0;
      const completed = p.target_km ? totalKm >= Number(p.target_km) : false;

      updates.push({ id: pid, update: {
        actual_km: totalKm,
        avg_pace_seconds: avgPaceSeconds,
        total_activities: validActivitiesCount,
        last_synced_at: new Date().toISOString(),

        // cached aggregates
        total_km: totalKm,
        valid_activities_count: validActivitiesCount,
        completion_rate: completionRate,
        completed,
        status: completed ? 'completed' : undefined,
      } });
    }

    const results: any[] = [];
    // Patch each participant (could batch in future)
    for (const u of updates) {
      const { data: d, error: e } = await service.from('challenge_participants').update(u.update).eq('id', u.id).select().maybeSingle();
      if (e) {
        console.error('Failed to update participant', u.id, e);
        results.push({ id: u.id, success: false, error: e.message });
      } else {
        results.push({ id: u.id, success: true, updated: d });
      }
    }

    return NextResponse.json({ ok: true, updated: results });
  } catch (err: any) {
    console.error('Exception in recalc route', err);
    const status = err?.status || 500;
    return NextResponse.json({ error: err?.message || String(err) }, { status });
  }
}
