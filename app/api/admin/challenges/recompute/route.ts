import { NextRequest, NextResponse } from 'next/server';
import serverDebug from '@/lib/server-debug';
import { requireAdminFromRequest } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';

// use shared `ensureAdmin` helper

export async function POST(request: NextRequest) {
  try {
    await requireAdminFromRequest((name: string) => request.cookies.get(name)?.value);

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      serverDebug.error('SUPABASE_SERVICE_ROLE_KEY not configured');
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const service = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Optional body: { challenge_id: <id> } to limit to single challenge
    const body = await request.json().catch(() => ({}));
    const bodyRec = (body && typeof body === 'object') ? (body as Record<string, unknown>) : {};
    const limitChallengeId = typeof bodyRec.challenge_id === 'string' ? bodyRec.challenge_id : undefined;

    // Fetch participant rows (all or limited by challenge)
    let partsQuery = service.from('challenge_participants').select('challenge_id');
    if (limitChallengeId) partsQuery = service.from('challenge_participants').select('challenge_id').eq('challenge_id', limitChallengeId);

    const { data: parts, error: pErr } = await partsQuery;
    if (pErr) {
      serverDebug.error('Failed to fetch participants for recompute', pErr);
      return NextResponse.json({ error: pErr.message }, { status: 500 });
    }

    const countsMap: Record<string, number> = {};
    (parts || []).forEach((p) => {
      const pRec = p as Record<string, unknown>;
      const cid = typeof pRec.challenge_id === 'string' ? pRec.challenge_id : undefined;
      if (!cid) return;
      countsMap[cid] = (countsMap[cid] || 0) + 1;
    });

    // Fetch target challenges
    let challengesQuery = service.from('challenges').select('id');
    if (limitChallengeId) challengesQuery = service.from('challenges').select('id').eq('id', limitChallengeId);
    const { data: challenges, error: chErr } = await challengesQuery;
    if (chErr) {
      serverDebug.error('Failed to fetch challenges for recompute', chErr);
      return NextResponse.json({ error: chErr.message }, { status: 500 });
    }

    const updates: Array<Record<string, unknown>> = [];
    for (const c of (challenges || [])) {
      const cRec = c as Record<string, unknown>;
      const cid = typeof cRec.id === 'string' ? cRec.id : String(cRec.id);
      const newCount = countsMap[cid] || 0;
      const { error: updErr } = await service
        .from('challenges')
        .update({ participant_count: newCount })
        .eq('id', cid)
        .select()
        .maybeSingle();
      if (updErr) {
        serverDebug.error('Failed to update challenge participant_count', cid, updErr);
        updates.push({ id: cid, success: false, error: updErr.message });
      } else {
        updates.push({ id: cid, success: true, participant_count: newCount });
      }
    }

    return NextResponse.json({ ok: true, updated: updates });
  } catch (err: unknown) {
    serverDebug.error('Exception in recompute route', err);
    const status = (err as Record<string, unknown>)?.status || 500;
    return NextResponse.json({ error: (err as Record<string, unknown>)?.message || String(err) }, { status: typeof status === 'number' ? status : 500 });
  }
}
