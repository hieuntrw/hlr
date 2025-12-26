import { NextRequest, NextResponse } from 'next/server';
import getSupabaseServiceClient from '@/lib/supabase-service-client';
import serverDebug from '@/lib/server-debug';
import { requireAdminFromRequest } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Require admin/mod authentication
    await requireAdminFromRequest((name: string) => request.cookies.get(name)?.value);
    
    const svc = getSupabaseServiceClient();
    const { data: challenges } = await svc.from('challenges').select('id, name, month, year').order('year', { ascending: false }).order('month', { ascending: false });
    const { data: winners } = await svc.from('lucky_draw_winners').select('*, challenge:challenges(id,name,month,year), member:profiles(full_name,email)').order('created_at', { ascending: false });
    const { data: members } = await svc.from('profiles').select('id,full_name,email').order('full_name', { ascending: true });
    return NextResponse.json({ challenges, winners, members });
  } catch (err: unknown) {
    serverDebug.error('[admin/lucky-draw-winners] exception', err);
    const status = (err as Record<string, unknown>)?.status || 500;
    return NextResponse.json({ error: (err as Record<string, unknown>)?.message || String(err) }, { status: typeof status === 'number' ? status : 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Require admin/mod authentication
    await requireAdminFromRequest((name: string) => request.cookies.get(name)?.value);
    
    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Missing body' }, { status: 400 });
    const svc = getSupabaseServiceClient();

    // Accept either direct insert payload (legacy) or run-draw command
    if (body.action === 'run' && body.challenge_id) {
      const challengeId = body.challenge_id as string;
      const numWinners = Number(body.num_winners ?? 2);

      // 1) fetch existing winners for this challenge
      type WinnerRow = { member_id: string | null };
      type EntryRow = { user_id: string; full_name?: string | null };

      const { data: existingWinners, error: ewErr } = await svc.from('lucky_draw_winners').select('member_id').eq('challenge_id', challengeId);
      if (ewErr) {
        serverDebug.error('[admin/lucky-draw-winners] fetch existing winners error', ewErr);
        return NextResponse.json({ error: ewErr.message }, { status: 500 });
      }
      const existingIds = (existingWinners || []).map((r: WinnerRow) => r.member_id).filter((id): id is string => !!id);

      // if already reached limit, return
      if (existingIds.length >= numWinners) {
        return NextResponse.json({ message: 'Challenge already has enough winners', winners: existingIds });
      }

      // 2) fetch eligible entries (not drawn yet)
      const { data: entries, error: eErr } = await svc.from('lucky_draw_entries').select('user_id,full_name').eq('challenge_id', challengeId).is('is_drawn', false);
      if (eErr) {
        serverDebug.error('[admin/lucky-draw-winners] fetch entries error', eErr);
        return NextResponse.json({ error: eErr.message }, { status: 500 });
      }

      // filter out existing winners
      const eligible = (entries || []).filter((en: EntryRow) => !existingIds.includes(en.user_id));
      if (!eligible.length) return NextResponse.json({ message: 'No eligible entries' });

      // shuffle and pick
      for (let i = eligible.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [eligible[i], eligible[j]] = [eligible[j], eligible[i]];
      }
      const toPick = Math.min(numWinners - existingIds.length, eligible.length);
      const picked = eligible.slice(0, toPick);

      // 3) insert winners and mark entries
      const insertPayload = picked.map((p: EntryRow) => ({ challenge_id: challengeId, member_id: p.user_id, reward_description: 'Lucky draw prize', status: 'pending' }));
      const { data: inserted, error: insErr } = await svc.from('lucky_draw_winners').insert(insertPayload).select();
      if (insErr) {
        serverDebug.error('[admin/lucky-draw-winners] insert winners error', insErr);
        return NextResponse.json({ error: insErr.message }, { status: 500 });
      }

      // mark entries as drawn
      const userIds = picked.map((p: EntryRow) => p.user_id);
      const { error: updErr } = await svc.from('lucky_draw_entries').update({ is_drawn: true, drawn_at: new Date() }).in('user_id', userIds).eq('challenge_id', challengeId);
      if (updErr) serverDebug.warn('[admin/lucky-draw-winners] failed to mark entries drawn', updErr);

      // 4) if total winners >= threshold (2) update challenges.lucky_draw_completed
      const totalWinners = existingIds.length + (inserted?.length || 0);
      if (totalWinners >= 2) {
        const { error: cErr } = await svc.from('challenges').update({ lucky_draw_completed: true }).eq('id', challengeId);
        if (cErr) serverDebug.warn('[admin/lucky-draw-winners] failed to flag challenge completed', cErr);
      }

      return NextResponse.json({ winners: inserted });
    }

    // Fallback: legacy direct insert
    const payload = Array.isArray(body) ? body : [body];
    const { data, error } = await svc.from('lucky_draw_winners').insert(payload).select();
    if (error) {
      serverDebug.error('[admin/lucky-draw-winners] insert error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ inserted: data });
  } catch (err: unknown) {
    serverDebug.error('[admin/lucky-draw-winners] exception', err);
    const status = (err as Record<string, unknown>)?.status || 500;
    return NextResponse.json({ error: (err as Record<string, unknown>)?.message || String(err) }, { status: typeof status === 'number' ? status : 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || !body.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const { id, ...updates } = body;
    const svc = getSupabaseServiceClient();
    const { data, error } = await svc.from('lucky_draw_winners').update(updates).eq('id', id).select();
    if (error) {
      serverDebug.error('[admin/lucky-draw-winners] update error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ updated: data });
  } catch (err: unknown) {
    serverDebug.error('[admin/lucky-draw-winners] exception', err);
    const status = (err as Record<string, unknown>)?.status || 500;
    return NextResponse.json({ error: (err as Record<string, unknown>)?.message || String(err) }, { status: typeof status === 'number' ? status : 500 });
  }
}
