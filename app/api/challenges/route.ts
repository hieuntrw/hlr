import { NextResponse, NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    // Pagination removed: always return full lists. The server will detect
    // an authenticated session for the personal view; the client should not
    // send `page`/`pageSize` anymore.
    const myParam = url.searchParams.get('my');
    let my = myParam === 'true';

    const supabase = createServerClient(
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

    // If `my` was not explicitly provided, try to detect an authenticated
    // session from cookies. This lets the client omit `?my=true` and rely on
    // the server to return the personal list when the request carries a
    // valid session (credentials: 'same-origin'). If no session exists we
    // fall back to the public listing below.
    if (!my && myParam === null) {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (user && !userError) {
        my = true;
      }
    }

    if (my) {
      // Require authenticated user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) return NextResponse.json({ error: 'Không xác thực' }, { status: 401 });

      // Fetch participant rows (joined with challenges) directly from
      // `challenge_participants` for this user. This returns one row per
      // participation and preserves ordering by `created_at`.
      const { data: rows, error: rowsError } = await supabase
        .from('challenge_participants')
        .select(
          // use actual DB column names; map to flattened response names below
          // Note: do not select `completion_rate` directly because older DBs may lack this column.
          // Compute it on-the-fly below using `target_km` when available.
          `challenge_id, target_km, actual_km, avg_pace_seconds, total_activities, completed, challenges(id, title, start_date, end_date, status, is_locked, created_at)`
        )
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (rowsError) {
        console.error('GET /api/challenges participations joined error', rowsError);
        return NextResponse.json({ error: rowsError.message }, { status: 500 });
      }

      if (!rows || rows.length === 0) return NextResponse.json({ challenges: [] });

      // Map rows to flattened challenge objects with participant fields
      const ordered = (rows || []).map((r: any) => {
        const ch = r.challenges;
        if (!ch) return null;
        // Compute completion_rate if possible (fallback to null if unavailable)
        let completionRate: number | null = null;
        try {
          const ak = r.actual_km != null ? Number(r.actual_km) : null;
          const tk = r.target_km != null ? Number(r.target_km) : null;
          if (ak != null && tk != null && tk > 0) {
            completionRate = Math.round((ak / tk) * 10000) / 100;
          }
        } catch (e) {
          completionRate = null;
        }

        return {
          ...ch,
          // Expose canonical cached aggregate column names in API responses
          actual_km: r.actual_km ?? null,
          avg_pace_seconds: r.avg_pace_seconds ?? null,
          total_activities: r.total_activities ?? null,
          completion_rate: completionRate,
          completed: r.completed ?? false,
          user_participates: true,
        };
      }).filter(Boolean);

      return NextResponse.json({ challenges: ordered });
    }
      // Public listing: return the full list (no pagination)
      const { data, error } = await supabase
        .from('challenges')
        .select('id, title, start_date, end_date, status, is_locked, created_at')
        .order('start_date', { ascending: false });

      if (error) {
        console.error('GET /api/challenges error', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ challenges: data || [] });
  } catch (err: any) {
    console.error('GET /api/challenges exception', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
