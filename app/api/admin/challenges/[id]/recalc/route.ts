import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import serverDebug from '@/lib/server-debug';
import ensureAdmin from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

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
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const service = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    // Optional body to limit to a single participant
    const body = await request.json().catch(() => ({}));
    const participantId = body?.participant_id as string | undefined;

    // Ensure challenge exists and is not locked. If locked, skip recalculation.
    const { data: challengeInfo, error: chInfoErr } = await service
      .from('challenges')
      .select('id,is_locked,start_date')
      .eq('id', challengeId)
      .maybeSingle();
    if (chInfoErr) {
      serverDebug.error('Failed to fetch challenge info', chInfoErr);
      const msg = (chInfoErr as { message?: string })?.message ?? String(chInfoErr);
      return NextResponse.json({ error: msg }, { status: 500 });
    }
    if (!challengeInfo) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }
    if (challengeInfo.is_locked) {
      return NextResponse.json({ ok: true, message: 'Challenge is locked; skipping recalc', updated: [] });
    }

    // Fetch participants for the challenge (or single participant if provided)
    // include `completed` so we can detect newly completed participants
    let partsQuery = service.from('challenge_participants').select('id,user_id,target_km,completed').eq('challenge_id', challengeId);
    if (participantId) partsQuery = service.from('challenge_participants').select('id,user_id,target_km,completed').eq('id', participantId).eq('challenge_id', challengeId);

    const { data: parts, error: partErr } = await partsQuery;
    if (partErr) {
      serverDebug.error('Failed to fetch participants', partErr);
      const msg = (partErr as { message?: string })?.message ?? String(partErr);
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    const participantIds = (parts || []).map((p) => (p as Record<string, unknown>).id).filter((x): x is string => typeof x === 'string');
    if (participantIds.length === 0) {
      return NextResponse.json({ ok: true, message: 'No participants found', updated: [] });
    }

    // Fetch activities for these participants
    const { data: acts, error: actErr } = await service
      .from('activities')
      .select('challenge_participant_id,distance,moving_time')
      .in('challenge_participant_id', participantIds);

    if (actErr) {
      serverDebug.error('Failed to fetch activities', actErr);
      const msg = (actErr as { message?: string })?.message ?? String(actErr);
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    // Aggregate in JS
    const byPart: Record<string, { totalMeters: number; totalSeconds: number; count: number }> = {};
    (acts || []).forEach((a) => {
      const aRec = a as Record<string, unknown>;
      const pid = aRec.challenge_participant_id;
      if (!pid || typeof pid !== 'string') return;
      if (!byPart[pid]) byPart[pid] = { totalMeters: 0, totalSeconds: 0, count: 0 };
      byPart[pid].totalMeters += Number(aRec.distance || 0);
      byPart[pid].totalSeconds += Number(aRec.moving_time || 0);
      byPart[pid].count += 1;
    });

    const updates: Array<Record<string, unknown>> = [];
    const starsToAward: Array<{ user_id: string; participant_id: string; stars: number }> = [];
    for (const p of (parts || [])) {
      const pid = p.id;
      const agg = byPart[pid] || { totalMeters: 0, totalSeconds: 0, count: 0 };
      const totalKm = Math.round((agg.totalMeters / 1000) * 100) / 100;
      const avgPaceSeconds = totalKm > 0 ? Math.round(agg.totalSeconds / totalKm) : null;
      const validActivitiesCount = agg.count;
      const completionRate = p.target_km ? Math.round((totalKm / Number(p.target_km)) * 10000) / 100 : 0;
      const completed = p.target_km ? totalKm >= Number(p.target_km) : false;

      // Persist `completion_rate` to the DB (canonical column) and also include it
      // in the response as `computed_completion_rate` for callers.
      updates.push({ id: pid, update: {
        actual_km: totalKm,
        avg_pace_seconds: avgPaceSeconds,
        total_activities: validActivitiesCount,
        last_synced_at: new Date().toISOString(),

        // cached aggregates (canonical column names)
        completion_rate: completionRate,
        completed,
        status: completed ? 'completed' : undefined,
      }, computed_completion_rate: completionRate });
      // If participant was not completed before but now is, queue star award
      const previouslyCompleted = !!(p as Record<string, unknown>).completed;
      if (!previouslyCompleted && completed) {
        // Determine stars to award using system setting if available, otherwise default rule
        let stars = 0;
        try {
          const { data: ss } = await service.from('system_settings').select('value').eq('key', 'challenge_star_milestones').maybeSingle();
          if (ss && ss.value) {
            try {
              const mapping = JSON.parse(String(ss.value)) as Record<string, number>;
              // Try exact match first
              const key = String(p.target_km ?? '');
              if (mapping && key in mapping) {
                stars = Number(mapping[key] || 0);
              } else {
                // fallback: find largest mapping key <= target_km
                const numericKeys = Object.keys(mapping || {}).map(k => Number(k)).filter(n => !isNaN(n)).sort((a,b) => a-b);
                for (const nk of numericKeys) {
                  if (Number(p.target_km) >= nk) stars = Number(mapping[String(nk)] || 0);
                }
              }
            } catch (e) {
              // invalid JSON — ignore
              stars = 0;
            }
          }
        } catch (_) {
          stars = 0;
        }
        if (!stars) {
          // Default rule: 1 star per 50 km (minimum 1)
          stars = Math.max(1, Math.floor(Number(p.target_km) / 50));
        }
        if (stars > 0) starsToAward.push({ user_id: p.user_id, participant_id: pid, stars });
      }
    }

    const results: Array<Record<string, unknown>> = [];
    // Patch each participant (could batch in future)
    for (const u of updates) {
      const uRec = u as Record<string, unknown>;
      const { data: d, error: e } = await service.from('challenge_participants').update(uRec.update as Record<string, unknown>).eq('id', uRec.id as string).select().maybeSingle();
      if (e) {
        serverDebug.error('Failed to update participant', uRec.id, e);
        const msg = (e as { message?: string })?.message ?? String(e);
        results.push({ id: uRec.id, success: false, error: msg });
      } else {
        // Include computed completion rate in the response for convenience.
        results.push({ id: uRec.id, success: true, updated: d, computed_completion_rate: uRec.computed_completion_rate ?? null });
      }
    }

    // Award stars for newly completed participants: increment profiles.total_stars
    const awards: Array<Record<string, unknown>> = [];
    for (const a of starsToAward) {
      try {
        // Read current total
        const { data: current, error: curErr } = await service.from('profiles').select('total_stars').eq('id', a.user_id).maybeSingle();
        if (curErr) throw curErr;
        const currentTotal = (current && (current as Record<string, unknown>).total_stars) ? Number((current as Record<string, unknown>).total_stars) : 0;
        const newTotal = currentTotal + Number(a.stars);
        const { data: pd, error: pdErr } = await service.from('profiles').update({ total_stars: newTotal }).eq('id', a.user_id).select().maybeSingle();
        if (pdErr) throw pdErr;
        awards.push({ user_id: a.user_id, participant_id: a.participant_id, stars: a.stars, new_total: newTotal });
      } catch (errAward) {
        serverDebug.error('Failed to award stars', a, errAward);
        awards.push({ user_id: a.user_id, participant_id: a.participant_id, stars: a.stars, error: String(errAward) });
      }
    }

    return NextResponse.json({ ok: true, updated: results });
  } catch (err: unknown) {
    serverDebug.error('Exception in recalc route', err);
    const status = (err as { status?: number })?.status ?? 500;
    const msg = (err as { message?: string })?.message ?? String(err);
    return NextResponse.json({ error: msg }, { status });
  }
}
