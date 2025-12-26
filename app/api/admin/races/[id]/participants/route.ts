import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import serverDebug from '@/lib/server-debug';
import { requireAdminFromRequest } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

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

    await requireAdminFromRequest((n: string) => request.cookies.get(n)?.value);

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    serverDebug.debug('POST /api/admin/races/[id]/participants body', { raceId, body });
    if (!body || !body.user_id) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });

    const userId = String(body.user_id);
    const distance = body.distance ? String(body.distance) : '21km';

    function timeToSeconds(t: string | number | undefined): number {
      if (typeof t === 'number') return t;
      if (!t || typeof t !== 'string') return 0;
      const parts = t.split(':').map((p) => parseInt(p || '0', 10));
      if (parts.length === 2) return parts[0] * 60 + parts[1];
      if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
      return 0;
    }

    const chipSeconds = ('chip_time_seconds' in body && typeof body.chip_time_seconds === 'number')
      ? (body.chip_time_seconds as number)
      : timeToSeconds((body.chip_time as string) ?? undefined);

    const payload = {
      race_id: raceId,
      user_id: userId,
      distance,
      chip_time_seconds: chipSeconds,
    } as Record<string, unknown>;

    // Allow optional podium_config_id
    if (body.podium_config_id) payload.podium_config_id = String(body.podium_config_id);

    const service = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
      : null;

    const client = service || supabaseAuth;

    const { data: inserted, error } = await client.from('race_results').insert(payload).select('id').maybeSingle();
    if (error) {
      serverDebug.error('POST add participant error', error);
      const msg = String(error.message || error);
      const errCode = (error as { code?: string }).code as string | undefined;
      if (errCode === '23505' || msg.includes('duplicate key')) {
        return NextResponse.json({ error: 'Participant already exists for this race' }, { status: 409 });
      }
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    const raceResultId = inserted?.id;

    // Trigger processing (best-effort)
    try {
      await fetch(`${request.nextUrl.origin}/api/admin/races/${raceId}/process-results`, { method: 'POST' });
    } catch (e) {
      serverDebug.warn('Failed to trigger process-results after add participant', e);
    }

    return NextResponse.json({ id: raceResultId });
  } catch (err: unknown) {
    serverDebug.error('POST /api/admin/races/[id]/participants exception', err);
    const status = (err as Record<string, unknown>)?.status || 500;
    return NextResponse.json({ error: (err as Record<string, unknown>)?.message || String(err) }, { status: typeof status === 'number' ? status : 500 });
  }
}
