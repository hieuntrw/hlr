import { NextResponse, NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
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

    // Ensure session is reconstructed from cookies so RLS sees the member (if any)
    async function ensureUserFromCookies() {
      const first = await supabaseAuth.auth.getUser();
      if (first.data.user) return first.data.user;
      try {
        const access = request.cookies.get('sb-access-token')?.value;
        const refresh = request.cookies.get('sb-refresh-token')?.value;
        if (access && refresh) {
          serverDebug.debug('[participants.route] attempting supabase.auth.setSession from cookies', { access: !!access, refresh: !!refresh });
          const setResp = await supabaseAuth.auth.setSession({ access_token: access, refresh_token: refresh });
          serverDebug.debug('[participants.route] setSession result error:', setResp.error?.message || null);
          const retry = await supabaseAuth.auth.getUser();
          if (retry.data.user) return retry.data.user;
        }
      } catch (e: unknown) {
        serverDebug.warn('[participants.route] session reconstruction failed', String(e));
      }
      return null;
    }

    // Try to initialize user from cookies so subsequent queries respect RLS
    await ensureUserFromCookies();

    // Ensure challenge exists
    const { data: challengeRow, error: challengeErr } = await supabaseAuth
      .from('challenges')
      .select('id, is_locked')
      .eq('id', id)
      .maybeSingle();

    if (challengeErr) {
      serverDebug.error('GET /api/challenges/[id]/participants fetch challenge error', challengeErr);
      return NextResponse.json({ error: 'Không thể lấy thông tin thử thách' }, { status: 500 });
    }

    if (!challengeRow) {
      return NextResponse.json({ error: 'Không tìm thấy thử thách' }, { status: 404 });
    }

    // Use service-role admin client to read full participant list and run recalc.
    // This endpoint is public/leaderboard-facing and should show all participants.
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      serverDebug.error('Missing SUPABASE service env for admin client');
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }

    const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // If challenge is active (not locked), trigger DB-side recalculation via admin client --> không cần thiết phải gọi lại vì đã có trigger khi sync activi
    /*if (!challengeRow.is_locked) {
      try {
        const { error: aggErr } = await adminSupabase.rpc('recalc_challenge_participant_aggregates', { p_challenge_id: id, p_participant_id: null });
        if (aggErr) serverDebug.warn('recalc_challenge_participant_aggregates error', aggErr);
      } catch (e) {
        serverDebug.warn('recalc_challenge_participant_aggregates rpc failed', e);
      }
    }
    */

    const { data, error } = await adminSupabase
      .from('challenge_participants')
      .select(
        `id, user_id, target_km, actual_km, avg_pace_seconds, total_activities, status, completion_rate, profiles(full_name, avatar_url)`
      )
      .eq('challenge_id', id)
      .order('actual_km', { ascending: false });

    if (error) {
      serverDebug.error('GET /api/challenges/[id]/participants error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Recalculate status per participant (DB function expects participant id) --> không cần thiết phải gọi lại vì đã có trigger khi sync activi
    /*
    try {
      const rows = data || [];
      for (const r of rows) {
        try {
          await supabaseAuth.rpc('recalc_challenge_participant_status', { p_participant_id: r.id });
          } catch (e) {
          serverDebug.warn('recalc_challenge_participant_status rpc failed for', r.id, e);
        }
      }
    } catch (e) {
      serverDebug.warn('Failed to run per-participant status recalc', e);
    }
    */
    const participants = (data || []).map((p: unknown) => {
      const pr = p as Record<string, unknown>;
      return {
        user_id: pr.user_id,
        target_km: pr.target_km,
        actual_km: pr.actual_km,
        avg_pace_seconds: pr.avg_pace_seconds,
        total_activities: pr.total_activities,
        status: pr.status,
        completion_rate: pr.completion_rate,
        profile: pr.profiles,
      };
    });

    return NextResponse.json({ participants });
  } catch (err: unknown) {
    serverDebug.error('GET /api/challenges/[id]/participants exception', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
