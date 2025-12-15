import { NextResponse, NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import serverDebug from '@/lib/server-debug'

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  try {
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set() {
            /* no-op on server route */
          },
          remove() {
            /* no-op on server route */
          },
        },
      }
    );

    // Ensure challenge exists
    const { data: challengeRow, error: challengeErr } = await supabaseAuth
      .from('challenges')
      .select('id, is_locked')
      .eq('id', id)
      .maybeSingle();

    if (challengeErr) {
      serverDebug.error('GET /api/challenges/[id]/leaderboard fetch challenge error', challengeErr);
      return NextResponse.json({ ok: false, error: 'Không thể lấy thông tin thử thách' }, { status: 500 });
    }

    if (!challengeRow) {
      return NextResponse.json({ ok: false, error: 'Không tìm thấy thử thách' }, { status: 404 });
    }

    // If challenge is active (not locked), run DB-side recalc functions so
    // leaderboards reflect the latest aggregates before reading.
    if (!challengeRow.is_locked) {
      try {
        const { error: aggErr } = await supabaseAuth.rpc('recalc_challenge_participant_aggregates', { p_challenge_id: id, p_participant_id: null });
        if (aggErr) serverDebug.warn('recalc_challenge_participant_aggregates error', aggErr);
      } catch (e) {
        serverDebug.warn('recalc_challenge_participant_aggregates rpc failed', e);
      }
    }

    const { data, error } = await supabaseAuth
      .from('challenge_participants')
      .select(
        `id, user_id, target_km, actual_km, avg_pace_seconds, total_activities, status, profiles(id, full_name, avatar_url)`
      )
      .eq('challenge_id', id)
      .order('actual_km', { ascending: false });

    if (error) {
      serverDebug.error('GET /api/challenges/[id]/leaderboard error', error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const rows: unknown[] = data || [];

    // Recalculate status per participant (DB function expects participant id)
    try {
      for (const r of rows) {
        const pr = r as Record<string, unknown>;
        try {
          await supabaseAuth.rpc('recalc_challenge_participant_status', { p_participant_id: pr.id });
        } catch (e: unknown) {
          serverDebug.warn('recalc_challenge_participant_status rpc failed for', pr.id, String(e));
        }
      }
    } catch (e: unknown) {
      serverDebug.warn('Failed to run per-participant status recalc', String(e));
    }

    // Compute dense ranks based on actual_km (ties get same rank)
    let lastKm: number | null = null;
    let lastRank = 0;
    let position = 0;

    const participants = rows.map((p: unknown) => {
      position += 1;
      const pr = p as Record<string, unknown>;
      const km = (pr.actual_km as number) || 0;
      if (lastKm === null || km < lastKm) {
        lastRank = position;
        lastKm = km;
      }

      return {
        user_id: pr.user_id,
        target_km: pr.target_km,
        actual_km: pr.actual_km,
        avg_pace_seconds: pr.avg_pace_seconds,
        total_activities: pr.total_activities,
        status: pr.status,
        profile: pr.profiles,
        rank: lastRank,
      };
    });

    return NextResponse.json({ ok: true, participants });
  } catch (err: unknown) {
    serverDebug.error('GET /api/challenges/[id]/leaderboard exception', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
