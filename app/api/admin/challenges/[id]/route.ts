import { NextResponse, NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import serverDebug from '@/lib/server-debug';
import ensureAdmin from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

// use shared `ensureAdmin` helper

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
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
          set() {},
          remove() {},
        },
      }
    );

    const authInfo = await ensureAdmin(supabaseAuth);
    // Only allow full admins to hide challenges; moderators can still edit other fields
    const role = (authInfo as Record<string, unknown>)?.role as string | undefined;

    const body = (await request.json()) as Record<string, unknown>;
    const { title, start_date, end_date, is_hide } = body;

    const updatePayload: Record<string, unknown> = {};
    if (title) updatePayload.title = title;
    if (start_date) updatePayload.start_date = start_date;
    if (end_date) updatePayload.end_date = end_date;
   // if (password !== undefined) updatePayload.password = password;
    // is_hide can only be set/unset by full admins
    if (is_hide !== undefined) {
      if (role !== 'admin') return NextResponse.json({ error: 'Only admin can change visibility' }, { status: 403 });
      updatePayload.is_hide = !!is_hide;
    }

    const { data, error } = await supabaseAuth
      .from('challenges')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) {
      serverDebug.error('PATCH /api/admin/challenges/[id] error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ challenge: data });
  } catch (err: unknown) {
    serverDebug.error('PATCH /api/admin/challenges/[id] exception', err);
    const status = (err as Record<string, unknown>)?.status || 500;
    return NextResponse.json({ error: (err as Record<string, unknown>)?.message || String(err) }, { status: typeof status === 'number' ? status : 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
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
          set() {},
          remove() {},
        },
      }
    );

    const authInfo = await ensureAdmin(supabaseAuth);
    // Only full admins may hide (soft-delete) challenges via DELETE
    const role = (authInfo as Record<string, unknown>)?.role as string | undefined;
    if (role !== 'admin') return NextResponse.json({ error: 'Only admin can hide challenges' }, { status: 403 });

    // Fetch challenge and participant count
    const { data: challenge, error: chErr } = await supabaseAuth
      .from('challenges')
      .select('id, start_date, status')
      .eq('id', id)
      .maybeSingle();
    if (chErr) {
      serverDebug.error('DELETE /api/admin/challenges/[id] fetch challenge error', chErr);
      return NextResponse.json({ error: chErr.message }, { status: 500 });
    }
    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }

    const startDate = challenge.start_date ? new Date(challenge.start_date) : null;
    const now = new Date();

    const { data: participantsData, error: pErr, count } = await supabaseAuth
      .from('challenge_participants')
      .select('id', { count: 'exact' })
      .eq('challenge_id', id);
    if (pErr) {
      serverDebug.error('DELETE /api/admin/challenges/[id] fetch participants error', pErr);
      return NextResponse.json({ error: pErr.message }, { status: 500 });
    }

    const participantCount = typeof count === 'number' ? count : (participantsData ? participantsData.length : 0);

    const notStarted = startDate ? now.getTime() < startDate.getTime() : false;
    const openAndNoParticipants = (challenge.status === 'Open') && participantCount === 0;

    if (!notStarted && !openAndNoParticipants) {
      return NextResponse.json({ error: 'Cannot delete: challenge already started or has participants' }, { status: 403 });
    }

    // Instead of hard-deleting, mark as hidden (is_hide = true)
    const { error: hideErr } = await supabaseAuth
      .from('challenges')
      .update({ is_hide: true })
      .eq('id', id);
    if (hideErr) {
      serverDebug.error('Ẩn (hide) /api/admin/challenges/[id] error', hideErr);
      return NextResponse.json({ error: hideErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    serverDebug.error('Ẩn /api/admin/challenges/[id] exception', err);
    const status = (err as Record<string, unknown>)?.status || 500;
    return NextResponse.json({ error: (err as Record<string, unknown>)?.message || String(err) }, { status: typeof status === 'number' ? status : 500 });
  }
}

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
          set() {},
          remove() {},
        },
      }
    );

    await ensureAdmin(supabaseAuth);

    const { data, error } = await supabaseAuth.from('challenges').select('*').eq('id', id).maybeSingle();
    if (error) {
      serverDebug.error('GET /api/admin/challenges/[id] error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ challenge: data });
  } catch (err: unknown) {
    serverDebug.error('GET /api/admin/challenges/[id] exception', err);
    const status = (err as Record<string, unknown>)?.status || 500;
    return NextResponse.json({ error: (err as Record<string, unknown>)?.message || String(err) }, { status: typeof status === 'number' ? status : 500 });
  }
}
