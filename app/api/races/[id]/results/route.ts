import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import ensureAdmin from '@/lib/server-auth';
import serverDebug from '@/lib/server-debug';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const raceId = params.id;

    const cookieStore = cookies();
    const hasSession = Boolean(
      cookieStore.get('sb-session') || cookieStore.get('sb-access-token') || cookieStore.get('sb-refresh-token')
    );
    if (!hasSession) {
      return NextResponse.json({ ok: false, error: 'Không xác thực' }, { status: 401 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
      serverDebug.error('Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL');
      return NextResponse.json({ ok: false, error: 'Server not configured' }, { status: 500 });
    }

    const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const { data, error } = await client
      .from('race_results')
      .select(`id, user_id, distance, chip_time_seconds, podium_config_id, is_pr, profiles(full_name, avatar_url)`)
      .eq('race_id', raceId)
      .order('chip_time_seconds', { ascending: true });

    if (error) {
      serverDebug.error('GET /api/races/[id]/results error', error);
      throw error;
    }

    return NextResponse.json({ ok: true, data });
  } catch (err: unknown) {
    serverDebug.error('GET /api/races/[id]/results exception', String(err));
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    // params are not required for this delete handler

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || !body.id) return NextResponse.json({ ok: false, error: 'Missing id' }, { status: 400 });
    const resultId = String(body.id);

    // Build a server auth client that can read cookies for admin check
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookies().get(name)?.value;
          },
          set() {},
          remove() {},
        },
      }
    );

    // ensure requester is admin
    try {
      await ensureAdmin(supabaseAuth, (n: string) => cookies().get(n)?.value);
    } catch (e) {
      serverDebug.warn('DELETE /api/races/[id]/results unauthorized', e);
      return NextResponse.json({ ok: false, error: 'Không có quyền' }, { status: 403 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
      serverDebug.error('Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL for delete');
      return NextResponse.json({ ok: false, error: 'Server not configured' }, { status: 500 });
    }

    const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const { error } = await service.from('race_results').delete().eq('id', resultId);
    if (error) {
      serverDebug.error('DELETE /api/races/[id]/results delete error', error);
      const errObj = error as unknown as Record<string, unknown>;
      const msg = errObj && typeof errObj.message === 'string'
        ? (errObj.message as string)
        : String(error || 'Unknown error');
      const detail = typeof errObj.details === 'string'
        ? `: ${(errObj.details as string)}`
        : '';
      return NextResponse.json({ ok: false, error: `${msg}${detail}` }, { status: 500 });
    }

    return NextResponse.json({ ok: true, deleted: resultId });
  } catch (err: unknown) {
    serverDebug.error('DELETE /api/races/[id]/results exception', String(err));
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
