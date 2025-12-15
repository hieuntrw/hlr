import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';
import serverDebug from '@/lib/server-debug';


async function ensureAdmin(supabaseAuth: SupabaseClient) {
  const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
  if (userError || !user) throw { status: 401, message: 'Không xác thực' };

  const { data: profile } = await supabaseAuth
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const role = profile?.role;
  if (!role || !['admin', 'mod_race'].includes(role)) throw { status: 403, message: 'Không có quyền' };
  return { user, role };
}

function timeToSeconds(t: string): number {
  const parts = t.split(":").map((p) => parseInt(p || "0", 10));
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const raceId = params.id;
  try {
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

    const service = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
      : null;

    const client = service || supabaseAuth;

    const { data, error } = await client
      .from('race_results')
      .select('id, user_id, distance, chip_time_seconds, official_rank, age_group_rank, evidence_link, is_pr, approved, category, milestone_name, profiles(full_name)')
      .eq('race_id', raceId)
      .order('chip_time_seconds', { ascending: true });

    if (error) {
      serverDebug.error('GET race results error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ data: data || [] });
  } catch (err: unknown) {
    serverDebug.error('GET /api/admin/races/[id]/results exception', err);
    const status = (err as Record<string, unknown>)?.status || 500;
    return NextResponse.json({ error: (err as Record<string, unknown>)?.message || String(err) }, { status: typeof status === 'number' ? status : 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const raceId = params.id;
  try {
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

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: 'Missing body' }, { status: 400 });

    const userId = typeof body.user_id === 'string' ? body.user_id : String(body.user_id || '');
    const distance = typeof body.distance === 'string' ? body.distance : String(body.distance || '');
    const chipSeconds = typeof body.chip_time_seconds === 'number' ? body.chip_time_seconds : timeToSeconds(String(body.chip_time || ''));
    const officialRank = typeof body.official_rank === 'number' ? body.official_rank : (typeof body.official_rank === 'string' ? parseInt(body.official_rank, 10) : null);
    const ageGroupRank = typeof body.age_group_rank === 'number' ? body.age_group_rank : (typeof body.age_group_rank === 'string' ? parseInt(body.age_group_rank, 10) : null);
    const evidenceLink = typeof body.evidence_link === 'string' ? body.evidence_link : null;

    const payload: Record<string, unknown> = {
      race_id: raceId,
      user_id: userId,
      distance: distance,
      chip_time_seconds: chipSeconds,
      official_rank: officialRank ?? null,
      age_group_rank: ageGroupRank ?? null,
      evidence_link: evidenceLink,
    };

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      // fallback to auth client
      const { data: inserted, error } = await supabaseAuth.from('race_results').insert(payload).select('id').maybeSingle();
      if (error) {
        serverDebug.error('Insert race_result error', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const raceResultId = inserted?.id;
      // Update PBs and pb_history using service client if available
      // For simplicity, trigger process-results to handle rewards and PB-related processing
      try {
        await fetch(`${request.nextUrl.origin}/api/admin/races/${raceId}/process-results`, { method: 'POST' });
      } catch (e) {
        serverDebug.warn('Failed to trigger process-results', e);
      }

      // Optionally create a manual member_rewards if provided
      if (body.reward_definition_id && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
        await service.from('member_rewards').insert({ user_id: body.user_id, race_result_id: raceResultId, reward_definition_id: body.reward_definition_id, status: 'pending' });
      }

      return NextResponse.json({ id: raceResultId });
    }

    // Prefer using service role for writes
    const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: inserted, error } = await service.from('race_results').insert(payload).select('id').maybeSingle();
    if (error) {
      serverDebug.error('Service insert race_result error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const raceResultId = inserted?.id;

    // Update PB logic: check and update profiles/pb_history
    if (distance === '21km' || distance === '42km') {
      const pbField = distance === '21km' ? 'pb_hm_seconds' : 'pb_fm_seconds';
      const { data: profile } = await service.from('profiles').select(pbField).eq('id', userId).single();
      const currentPB = profile ? (profile as Record<string, unknown>)[pbField] : null;
      if (!currentPB || (typeof chipSeconds === 'number' && chipSeconds < (currentPB as number))) {
        await service.from('profiles').update({ [pbField]: chipSeconds }).eq('id', userId);
        await service.from('pb_history').insert({ user_id: userId, distance: distance === '21km' ? 'HM' : 'FM', time_seconds: chipSeconds, achieved_at: new Date().toISOString().slice(0,10), race_id: raceId });
        // Mark PR and approved on race_results
        await service.from('race_results').update({ is_pr: true, approved: true }).eq('id', raceResultId);
      }
    }

    // Trigger reward processing for the race (best-effort)
    try {
      await fetch(`${request.nextUrl.origin}/api/admin/races/${raceId}/process-results`, { method: 'POST' });
    } catch (e) {
      serverDebug.warn('Failed to trigger process-results', e);
    }

    // If admin selected a reward manually, insert member_rewards
    if (body.reward_definition_id) {
      await service.from('member_rewards').insert({ user_id: body.user_id, race_result_id: raceResultId, reward_definition_id: body.reward_definition_id, status: 'pending' });
    }

    return NextResponse.json({ id: raceResultId });
  } catch (err: unknown) {
    serverDebug.error('POST /api/admin/races/[id]/results exception', err);
    const status = (err as Record<string, unknown>)?.status || 500;
    return NextResponse.json({ error: (err as Record<string, unknown>)?.message || String(err) }, { status: typeof status === 'number' ? status : 500 });
  }
}
