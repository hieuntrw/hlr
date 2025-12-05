import { NextResponse, NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

async function ensureAdmin(supabaseAuth: any) {
  const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
  if (userError || !user) throw { status: 401, message: 'Không xác thực' };

  const { data: profile } = await supabaseAuth
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const role = profile?.role;
  if (!role || !['admin', 'mod_challenge'].includes(role)) throw { status: 403, message: 'Không có quyền' };
}

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

    await ensureAdmin(supabaseAuth);

    const body = await request.json();
    const { title, start_date, end_date, password } = body;

    const updatePayload: any = {};
    if (title) updatePayload.title = title;
    if (start_date) updatePayload.start_date = start_date;
    if (end_date) updatePayload.end_date = end_date;
    if (password !== undefined) updatePayload.password = password;

    const { data, error } = await supabaseAuth
      .from('challenges')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) {
      console.error('PATCH /api/admin/challenges/[id] error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ challenge: data });
  } catch (err: any) {
    console.error('PATCH /api/admin/challenges/[id] exception', err);
    const status = err?.status || 500;
    return NextResponse.json({ error: err?.message || String(err) }, { status });
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

    await ensureAdmin(supabaseAuth);

    // Fetch challenge and participant count
    const { data: challenge, error: chErr } = await supabaseAuth
      .from('challenges')
      .select('id, start_date, status')
      .eq('id', id)
      .maybeSingle();
    if (chErr) {
      console.error('DELETE /api/admin/challenges/[id] fetch challenge error', chErr);
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
      console.error('DELETE /api/admin/challenges/[id] fetch participants error', pErr);
      return NextResponse.json({ error: pErr.message }, { status: 500 });
    }

    const participantCount = typeof count === 'number' ? count : (participantsData ? participantsData.length : 0);

    const notStarted = startDate ? now.getTime() < startDate.getTime() : false;
    const openAndNoParticipants = (challenge.status === 'Open') && participantCount === 0;

    if (!notStarted && !openAndNoParticipants) {
      return NextResponse.json({ error: 'Cannot delete: challenge already started or has participants' }, { status: 403 });
    }

    // Delete challenge
    const { error: delErr } = await supabaseAuth
      .from('challenges')
      .delete()
      .eq('id', id);
    if (delErr) {
      console.error('DELETE /api/admin/challenges/[id] delete error', delErr);
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('DELETE /api/admin/challenges/[id] exception', err);
    const status = err?.status || 500;
    return NextResponse.json({ error: err?.message || String(err) }, { status });
  }
}
