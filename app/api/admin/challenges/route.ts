import { NextResponse, NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

async function ensureAdmin(supabaseAuth: any) {
  const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
  if (userError || !user) throw { status: 401, message: 'Không xác thực' };

  const role = (user as any).user_metadata?.role as string | undefined;
  if (!role || !['admin', 'mod_challenge'].includes(role)) throw { status: 403, message: 'Không có quyền' };

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

    const user = await ensureAdmin(supabaseAuth);

    const body = await request.json();
    const { title, start_date, end_date, registration_deadline, min_pace_seconds, max_pace_seconds, min_km, description, require_map } = body;
    if (!title || !start_date || !end_date) {
      return NextResponse.json({ error: 'Thiếu trường bắt buộc' }, { status: 400 });
    }

    const insertPayload: any = { title, start_date, end_date };
    // set creator
    if (user && (user as any).id) insertPayload.created_by = (user as any).id;
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
      console.error('POST /api/admin/challenges error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ challenge: data });
  } catch (err: any) {
    console.error('POST /api/admin/challenges exception', err);
    const status = err?.status || 500;
    return NextResponse.json({ error: err?.message || String(err) }, { status });
  }
}
