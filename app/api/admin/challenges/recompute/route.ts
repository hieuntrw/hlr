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

export async function POST(request: NextRequest) {
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

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('SUPABASE_SERVICE_ROLE_KEY not configured');
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const service = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Optional body: { challenge_id: <id> } to limit to single challenge
    const body = await request.json().catch(() => ({}));
    const limitChallengeId = body?.challenge_id as string | undefined;

    // Fetch participant rows (all or limited by challenge)
    let partsQuery = service.from('challenge_participants').select('challenge_id');
    if (limitChallengeId) partsQuery = service.from('challenge_participants').select('challenge_id').eq('challenge_id', limitChallengeId);

    const { data: parts, error: pErr } = await partsQuery;
    if (pErr) {
      console.error('Failed to fetch participants for recompute', pErr);
      return NextResponse.json({ error: pErr.message }, { status: 500 });
    }

    const countsMap: Record<string, number> = {};
    (parts || []).forEach((p: any) => {
      const cid = p.challenge_id;
      if (!cid) return;
      countsMap[cid] = (countsMap[cid] || 0) + 1;
    });

    // Fetch target challenges
    let challengesQuery = service.from('challenges').select('id');
    if (limitChallengeId) challengesQuery = service.from('challenges').select('id').eq('id', limitChallengeId);
    const { data: challenges, error: chErr } = await challengesQuery;
    if (chErr) {
      console.error('Failed to fetch challenges for recompute', chErr);
      return NextResponse.json({ error: chErr.message }, { status: 500 });
    }

    const updates: any[] = [];
    for (const c of (challenges || [])) {
      const newCount = countsMap[c.id] || 0;
      const { data: updated, error: updErr } = await service
        .from('challenges')
        .update({ participant_count: newCount })
        .eq('id', c.id)
        .select()
        .maybeSingle();
      if (updErr) {
        console.error('Failed to update challenge participant_count', c.id, updErr);
        updates.push({ id: c.id, success: false, error: updErr.message });
      } else {
        updates.push({ id: c.id, success: true, participant_count: newCount });
      }
    }

    return NextResponse.json({ ok: true, updated: updates });
  } catch (err: any) {
    console.error('Exception in recompute route', err);
    const status = err?.status || 500;
    return NextResponse.json({ error: err?.message || String(err) }, { status });
  }
}
