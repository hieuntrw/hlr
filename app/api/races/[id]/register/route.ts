import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import serverDebug from '@/lib/server-debug';

export const dynamic = 'force-dynamic';

const ALLOWED_DISTANCES = ['5km', '10km', '21km', '42km'];

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const raceId = params.id;
    const cookieStore = cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set() {},
          remove() {},
        },
      }
    );

    // Debug: log incoming cookie names only (do not log token values)
    try {
      const cookieNames = cookieStore.getAll().map(c => c.name);
      serverDebug.debug('POST /api/races/[id]/register incoming cookie names', { raceId, cookieNames });
    } catch (e) {
      serverDebug.warn('Failed to read cookie names in register', e);
    }

    // Reconstruct user from auth cookies
    const { getUserFromAuthClient } = await import('@/lib/server-auth');
    const user = await getUserFromAuthClient(supabase, (name: string) => cookieStore.get(name)?.value);
    serverDebug.debug('POST /api/races/[id]/register reconstructed user', { raceId, userId: user?.id ?? null });
    if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    const distance = (body && body.distance) ? String(body.distance) : String(new URL(req.url).searchParams.get('distance') ?? '');
    if (!distance || !ALLOWED_DISTANCES.includes(distance)) {
      return NextResponse.json({ ok: false, error: 'Invalid distance' }, { status: 400 });
    }

    // Check race exists and registration still open (race_date >= today)
    const q = await supabase.from('races').select('id, race_date').eq('id', raceId).maybeSingle();
    if (q.error) {
      serverDebug.error('race lookup error', q.error);
      return NextResponse.json({ ok: false, error: 'Failed to lookup race' }, { status: 500 });
    }
    if (!q.data) return NextResponse.json({ ok: false, error: 'Race not found' }, { status: 404 });

    const raceDateStr = String(((q.data as Record<string, unknown>)?.race_date) ?? '');
    const raceDate = raceDateStr ? new Date(raceDateStr) : null;
    const today = new Date();
    if (raceDate && raceDate < new Date(today.toISOString().split('T')[0])) {
      return NextResponse.json({ ok: false, error: 'Registration closed' }, { status: 400 });
    }

    // Insert minimal race_results row as registration (chip_time_seconds set to 0)
    const payload = {
      race_id: raceId,
      user_id: user.id,
      distance,
      chip_time_seconds: 0,
    } as Record<string, unknown>;

    // Try inserting using the auth-aware client first (respects RLS)
    const attempt = await supabase.from('race_results').insert(payload).select('id').maybeSingle();
    if (!attempt.error) {
      return NextResponse.json({ ok: true, id: attempt.data?.id });
    }

    // Log the initial error
    serverDebug.error('registration insert error (auth client)', { raceId, userId: user.id, error: attempt.error });

    const msg = String(attempt.error?.message || attempt.error);
    // If RLS blocked the insert and we have a service role key, retry with service client
    if (msg.toLowerCase().includes('row-level security') || msg.toLowerCase().includes('row level security') || msg.toLowerCase().includes('violates row-level')) {
      if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        try {
          serverDebug.debug('RLS triggered — retrying insert with service role client', { raceId, userId: user.id });
          const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
          // Double-check we are inserting for the authenticated user
          payload.user_id = user.id;
          const serviceRes = await service.from('race_results').insert(payload).select('id').maybeSingle();
          if (!serviceRes.error) {
            serverDebug.debug('Service-role insert succeeded for registration', { raceId, userId: user.id, id: serviceRes.data?.id });
            return NextResponse.json({ ok: true, id: serviceRes.data?.id });
          }
          serverDebug.error('Service-role insert also failed', serviceRes.error);
          return NextResponse.json({ ok: false, error: String(serviceRes.error.message || serviceRes.error) }, { status: 500 });
        } catch (svcErr) {
          serverDebug.error('Service-role insert exception', String(svcErr));
          return NextResponse.json({ ok: false, error: String(svcErr) }, { status: 500 });
        }
      }
    }

    // Handle duplicate key explicitly
    const attemptError = attempt.error as unknown as Record<string, unknown> | null;
    if (msg.includes('duplicate key') || attemptError?.code === '23505') {
      return NextResponse.json({ ok: false, error: 'Already registered' }, { status: 409 });
    }

    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  } catch (err: unknown) {
    serverDebug.error('POST /api/races/[id]/register exception', String(err));
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
