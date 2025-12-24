import { NextResponse, NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import serverDebug from '@/lib/server-debug';
import ensureAdmin from '@/lib/server-auth';

// use shared `ensureAdmin` helper

export async function POST(request: NextRequest) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      serverDebug.error('SUPABASE_SERVICE_ROLE_KEY not configured');
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
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

    const { user } = await ensureAdmin(supabaseAuth, (n: string) => request.cookies.get(n)?.value);

    const body = (await request.json()) as Record<string, unknown>;
    const { title, start_date, end_date, registration_deadline, min_pace_seconds, max_pace_seconds, min_km, description, require_map } = body;
    if (!title || !start_date || !end_date) {
      return NextResponse.json({ error: 'Thiếu trường bắt buộc' }, { status: 400 });
    }

    const insertPayload: Record<string, unknown> = { title, start_date, end_date };
    // set creator
    if (user?.id) insertPayload.created_by = user.id;
    if (registration_deadline) insertPayload.registration_deadline = registration_deadline;
    // Persist pace and description when provided. `require_map` is kept for API compatibility but not persisted (no migration).
    if (min_pace_seconds !== undefined && min_pace_seconds !== null) insertPayload.min_pace_seconds = Number(min_pace_seconds);
    if (max_pace_seconds !== undefined && max_pace_seconds !== null) insertPayload.max_pace_seconds = Number(max_pace_seconds);
    // Persist min_km when provided (positive integer)
    if (min_km !== undefined && min_km !== null) {
      const n = Number(min_km) || 0;
      if (n > 0) insertPayload.min_km = Math.floor(n);
    }
    if (description) insertPayload.description = description;
    // persist require_map if provided
    if (require_map !== undefined && require_map !== null) insertPayload.require_map = !!require_map;

    const { data, error } = await supabaseAuth
      .from('challenges')
      .insert([insertPayload])
      .select()
      .maybeSingle();

    if (error) {
      serverDebug.error('POST /api/admin/challenges error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ challenge: data });
  } catch (err: unknown) {
    serverDebug.error('POST /api/admin/challenges exception', err);
    const status = (err as Record<string, unknown>)?.status || 500;
    return NextResponse.json({ error: (err as Record<string, unknown>)?.message || String(err) }, { status: typeof status === 'number' ? status : 500 });
  }
}
