import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import serverDebug from '@/lib/server-debug';
import ensureAdmin from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest, { params }: { params: { id: string; resultId: string } }) {
  const raceId = params.id;
  const resultId = params.resultId;
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
    if (!body || Object.keys(body).length === 0) return NextResponse.json({ error: 'Missing updates' }, { status: 400 });

    const updates: Record<string, unknown> = {};
    const allowed = ['chip_time_seconds', 'distance', 'podium_config_id', 'status', 'is_pr', 'user_id'];
    for (const k of allowed) {
      if (k in body) updates[k] = (body as Record<string, unknown>)[k] as unknown;
    }

    if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'No allowed fields to update' }, { status: 400 });

    const service = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
      : null;
    const client = service || supabaseAuth;

    const { data, error } = await client.from('race_results').update(updates).eq('id', resultId).select().maybeSingle();
    if (error) {
      serverDebug.error('PATCH participant update error', error);
      return NextResponse.json({ error: error.message || String(error) }, { status: 500 });
    }

    // Re-run processing if certain fields changed
    try {
      await fetch(`${request.nextUrl.origin}/api/admin/races/${raceId}/process-results`, { method: 'POST' });
    } catch (e) {
      serverDebug.warn('Failed to trigger process-results after participant update', e);
    }

    return NextResponse.json({ updated: data });
  } catch (err: unknown) {
    serverDebug.error('PATCH /api/admin/races/[id]/participants/[resultId] exception', err);
    const status = (err as Record<string, unknown>)?.status || 500;
    return NextResponse.json({ error: (err as Record<string, unknown>)?.message || String(err) }, { status: typeof status === 'number' ? status : 500 });
  }
}
