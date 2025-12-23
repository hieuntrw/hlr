import { NextResponse, NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createServerClient } from '@supabase/ssr';
import serverDebug from '@/lib/server-debug'

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  try {
    // Create server supabase client to read session from cookies
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

    // Diagnostic logging: capture incoming cookie names and raw header for debugging
    try {
      // Use getAll() to list cookie names in Next.js RequestCookies
      const cookieNames = request.cookies.getAll ? request.cookies.getAll().map(c => c.name) : [];
      serverDebug.debug('[join.route] incoming cookies:', cookieNames);
    } catch (e) {
      serverDebug.debug('[join.route] could not read request.cookies.getAll()', e);
    }
    try {
      const rawCookie = request.headers.get('cookie');
      serverDebug.debug('[join.route] raw Cookie header:', rawCookie ? rawCookie.slice(0, 500) : null);
    } catch (e) {
      serverDebug.debug('[join.route] could not read raw Cookie header', e);
    }

    const { getUserFromAuthClient } = await import('@/lib/server-auth');
    const user = await getUserFromAuthClient(supabaseAuth, (name: string) => request.cookies.get(name)?.value);
    if (!user) return NextResponse.json({ error: 'Không xác thực' }, { status: 401 });

    const rawBody = (await request.json()) as unknown;
    const parsedBody = (typeof rawBody === 'object' && rawBody) ? rawBody as Record<string, unknown> : {};
    const target_km = typeof parsedBody.target_km === 'number' || typeof parsedBody.target_km === 'string' ? parsedBody.target_km : undefined;
    if (target_km === undefined || target_km === null || (typeof target_km === 'string' && target_km.trim() === '')) {
      return NextResponse.json({ error: 'target_km required' }, { status: 400 });
    }

    // Validate challenge existence and password server-side to prevent client bypass
    const { data: challengeRow, error: challengeErr } = await supabaseAuth
      .from('challenges')
      .select('is_locked')
      .eq('id', id)
      .maybeSingle();

    if (challengeErr) {
      serverDebug.error('POST /api/challenges/[id]/join fetch challenge error', challengeErr);
      return NextResponse.json({ error: 'Không thể lấy thông tin thử thách' }, { status: 500 });
    }

    if (!challengeRow) {
      return NextResponse.json({ error: 'Không tìm thấy thử thách' }, { status: 404 });
    }

    if (challengeRow.is_locked) {
      return NextResponse.json({ error: 'Thử thách đã bị khoá, không thể đăng ký', }, { status: 403 });
    }

    // Passwords are deprecated; do not require a password to join

    const user_id = user.id;

    // Insert participant if not exists
    const { data: existing, error: existingErr } = await supabaseAuth
      .from('challenge_participants')
      .select('id')
      .eq('challenge_id', id)
      .eq('user_id', user_id)
      .maybeSingle();

      if (existingErr) {
      serverDebug.error('POST /api/challenges/[id]/join existing check error', existingErr);
      return NextResponse.json({ error: existingErr.message }, { status: 500 });
    }

    if (existing) {
      // Update existing participation's target_km
      const { data: updated, error: updateErr } = await supabaseAuth
        .from('challenge_participants')
        .update({ target_km })
        .eq('id', existing.id)
        .select()
        .maybeSingle();

      if (updateErr) {
        serverDebug.error('POST /api/challenges/[id]/join update error', updateErr);
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }

      serverDebug.debug('[join.route] participant updated successfully', { id: updated?.id, user_id, challenge_id: id, target_km });
      try {
        revalidatePath(`/challenges/${id}`);
        revalidatePath('/challenges');
        revalidatePath('/dashboard');
      } catch (e) {
        serverDebug.warn('[join.route] revalidatePath failed', String(e));
      }
      return NextResponse.json({ participant: updated });
    }

    const { data, error } = await supabaseAuth
      .from('challenge_participants')
      .insert([
        { challenge_id: id, user_id, target_km }
      ])
      .select()
      .maybeSingle();

    if (error) {
      serverDebug.error('POST /api/challenges/[id]/join error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    serverDebug.debug('[join.route] participant inserted successfully', { id: data?.id, user_id, challenge_id: id, target_km });
    try {
      revalidatePath(`/challenges/${id}`);
      revalidatePath('/challenges');
      revalidatePath('/dashboard');
    } catch (e) {
      serverDebug.warn('[join.route] revalidatePath failed', String(e));
    }
    return NextResponse.json({ participant: data });
    } catch (err: unknown) {
      serverDebug.error('POST /api/challenges/[id]/join exception', err);
      return NextResponse.json({ error: String(err) }, { status: 500 });
    }
}
