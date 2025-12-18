import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';
import serverDebug from '@/lib/server-debug';


async function ensureAdmin(supabaseAuth: SupabaseClient) {
  const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
  if (userError || !user) throw { status: 401, message: 'Không xác thực' };

  // Prefer role from JWT app_metadata; fallback to profiles.role is not available after migration
  const sessionAppMeta = (user as unknown as { app_metadata?: Record<string, unknown> })?.app_metadata;
  const role = sessionAppMeta && typeof sessionAppMeta === 'object' ? (sessionAppMeta as Record<string, unknown>)['role'] as string | undefined : undefined;
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

    // Try selecting with `approved` column; if the column doesn't exist (older schema), fall back.
    let data: unknown = null;
    try {
      const res = await client
        .from('race_results')
        .select('id, user_id, distance, chip_time_seconds, is_pr, approved, podium_config_id, profiles(full_name, gender)')
        .eq('race_id', raceId)
        .order('chip_time_seconds', { ascending: true });
      if (res.error) {
        // If error is due to missing column, fallthrough to alternate query
        if (!/column .*approved.*does not exist/i.test(String(res.error.message || ''))) {
          serverDebug.error('GET race results error', res.error);
          return NextResponse.json({ error: res.error.message }, { status: 500 });
        }
      } else {
        data = res.data;
      }
    } catch {
      // ignore and fallback
    }

    if (!data) {
      const res2 = await client
        .from('race_results')
        .select('id, user_id, distance, chip_time_seconds, is_pr, podium_config_id, profiles(full_name, gender)')
        .eq('race_id', raceId)
        .order('chip_time_seconds', { ascending: true });
      if (res2.error) {
        serverDebug.error('GET race results error (fallback)', res2.error);
        return NextResponse.json({ error: res2.error.message }, { status: 500 });
      }
      data = res2.data;
    }

    // Attach any member_milestone_rewards / member_podium_rewards info for the returned race_result ids
    const rows = (data || []) as Array<Record<string, unknown>>;
    try {
      const ids = rows.map((r) => String(r.id ?? '')).filter(Boolean);
      if (ids.length > 0) {
        // milestones
        const { data: mm, error: mmErr } = await client
          .from('member_milestone_rewards')
          .select('id, race_result_id, status, milestone_id, reward_description, reward_milestones(id, milestone_name, reward_description)')
          .in('race_result_id', ids);

        if (!mmErr && mm) {
          const mMap = new Map<string, Record<string, unknown>>();
          for (const rwd of mm as Array<Record<string, unknown>>) {
            const rrid = String(rwd.race_result_id ?? '');
            const mmMeta = (rwd.reward_milestones as Record<string, unknown> | undefined) || null;
            mMap.set(rrid, { type: 'milestone', milestone_id: rwd.milestone_id, milestone_name: mmMeta?.['milestone_name'] ?? mmMeta?.['reward_description'] ?? rwd.reward_description ?? null });
          }

          for (const r of rows) {
            const rid = String(r.id ?? '');
            const found = mMap.get(rid);
            if (found) (r as Record<string, unknown>)['milestone_reward'] = found['milestone_name'] ?? null;
          }
        }

        // podiums
        const { data: pr, error: prErr } = await client
          .from('member_podium_rewards')
          .select('id, race_result_id, status, podium_config_id, reward_description, reward_podium_config(id, reward_description)')
          .in('race_result_id', ids);

        if (!prErr && pr) {
          const pMap = new Map<string, Record<string, unknown>>();
          for (const rwd of pr as Array<Record<string, unknown>>) {
            const rrid = String(rwd.race_result_id ?? '');
            const pc = (rwd.reward_podium_config as Record<string, unknown> | undefined) || null;
            pMap.set(rrid, { type: 'podium', podium_config_id: rwd.podium_config_id, podium_name: pc?.['reward_description'] ?? rwd.reward_description ?? null });
          }

          for (const r of rows) {
            const rid = String(r.id ?? '');
            const found = pMap.get(rid);
            if (found && !(r as Record<string, unknown>)['milestone_reward']) {
              (r as Record<string, unknown>)['milestone_reward'] = found['podium_name'] ?? null;
            }
          }
        }
      }
    } catch (e) {
      serverDebug.warn('Failed to fetch member rewards for race results', e);
    }

    return NextResponse.json({ data: rows || [] });
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
  
    const payload: Record<string, unknown> = {
      race_id: raceId,
      user_id: userId,
      distance: distance,
      chip_time_seconds: chipSeconds,
    };

    // Accept optional `podium_config_id` (admin-selected podium config)
    if (body.podium_config_id) {
      payload.podium_config_id = String(body.podium_config_id);
    }

    // Defensive: remove any accidental/legacy fields that don't exist in the new schema
    if ('category' in body) {
      serverDebug.warn('Legacy field `category` present in request body — removing before insert');
      try {
        delete (body as Record<string, unknown>)['category'];
      } catch {
        // ignore
      }
    }
    if ('category' in payload) delete (payload as Record<string, unknown>)['category'];

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      // fallback to auth client — use upsert with onConflict to avoid duplicate-key 23505
      const { data: inserted, error } = await supabaseAuth
        .from('race_results')
        .upsert(payload, { onConflict: 'race_id,user_id,distance' })
        .select('id')
        .maybeSingle();
      if (error) {
        serverDebug.error('Insert/upsert race_result error', error);
        const msg = String(error.message || error);
        const errCode = (error as { code?: string }).code as string | undefined;
        if (errCode === '23505' || msg.includes('duplicate key')) {
          return NextResponse.json({ error: 'Duplicate race result exists' }, { status: 409 });
        }
        return NextResponse.json({ error: msg }, { status: 500 });
      }

      const raceResultId = inserted?.id;
      // Update PBs and pb_history using service client if available
      // For simplicity, trigger process-results to handle rewards and PB-related processing
      try {
        await fetch(`${request.nextUrl.origin}/api/admin/races/${raceId}/process-results`, { method: 'POST' });
      } catch (e) {
        serverDebug.warn('Failed to trigger process-results', e);
      }

      // Legacy/manual reward insertion into `member_rewards` has been deprecated in code.
      // If admins need to assign milestone/podium rewards, use the specialized admin endpoints
      // or create rows in `member_milestone_rewards` / `member_podium_rewards` directly.

      return NextResponse.json({ id: raceResultId });
    }

    // Prefer using service role for writes
    const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: inserted, error } = await service
      .from('race_results')
      .upsert(payload, { onConflict: 'race_id,user_id,distance' })
      .select('id')
      .maybeSingle();
    if (error) {
      serverDebug.error('Service insert/upsert race_result error', error);
      const msg = String(error.message || error);
      const errCode = (error as { code?: string }).code as string | undefined;
      if (errCode === '23505' || msg.includes('duplicate key')) {
        return NextResponse.json({ error: 'Duplicate race result exists' }, { status: 409 });
      }
      return NextResponse.json({ error: msg }, { status: 500 });
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

    // Manual assignment via legacy `reward_definition_id` is intentionally skipped here.
    // Use `member_milestone_rewards` or `member_podium_rewards` insertion paths instead.

    return NextResponse.json({ id: raceResultId });
  } catch (err: unknown) {
    serverDebug.error('POST /api/admin/races/[id]/results exception', err);
    const status = (err as Record<string, unknown>)?.status || 500;
    return NextResponse.json({ error: (err as Record<string, unknown>)?.message || String(err) }, { status: typeof status === 'number' ? status : 500 });
  }
}
