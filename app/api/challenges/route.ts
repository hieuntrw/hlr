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
        .eq('user_id', user.id);

      if (rowsError) {
        console.error('GET /api/challenges participations joined error', rowsError);
        return NextResponse.json({ error: rowsError.message }, { status: 500 });
      }

      if (!rows || rows.length === 0) return NextResponse.json({ challenges: [] });

      // Some DB instances do not have `challenge_participants.created_at`. The previous
      // implementation relied on ordering by that column which can cause "column does not exist"
      // errors. Instead, sort the fetched rows in JS by the joined challenge's `created_at`
      // (which is present on `challenges`) so the "Thử Thách Của Tôi" tab preserves the
      // intended ordering without requiring a schema change to `challenge_participants`.
      const sortedRows = (rows || []).slice().sort((a: any, b: any) => {
        const aTime = a.challenges?.created_at ? new Date(a.challenges.created_at).getTime() : 0;
        const bTime = b.challenges?.created_at ? new Date(b.challenges.created_at).getTime() : 0;
        return bTime - aTime;
      });

      // Map rows to flattened challenge objects with participant fields
      const ordered = (sortedRows || []).map((r: any) => {
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
      // Public listing: return the full list (no pagination).
      // Try to apply server-side filtering `.neq('is_hide', true)` when the
      // column exists so the database does the work. Fallback to a safe
      // select+client-side filter if the column is missing in older DBs.
      let publicResult;
      try {
        publicResult = await supabase
          .from('challenges')
          .select('id, title, start_date, end_date, status, is_locked, created_at')
          .neq('is_hide', true)
          .order('start_date', { ascending: false });
      } catch (e) {
        // Some Supabase clients may throw when calling `.neq` with a missing
        // column; fall back to a safe select and filter in JS below.
        console.warn('[Challenges] server-side is_hide filter failed, falling back to client filter', e);
        publicResult = await supabase
          .from('challenges')
          .select('id, title, start_date, end_date, status, is_locked, created_at, is_hide')
          .order('start_date', { ascending: false });
        if (publicResult.error) {
          // If even the select fails (older DB without is_hide), retry without is_hide
          const msg = String(publicResult.error.message || publicResult.error || '');
          if (/is_hide/i.test(msg) && /does not exist/i.test(msg)) {
            console.warn('[Challenges] is_hide not present in DB, retrying without is_hide');
            publicResult = await supabase
              .from('challenges')
              .select('id, title, start_date, end_date, status, is_locked, created_at')
              .order('start_date', { ascending: false });
          }
        }
      }

      if (publicResult.error) {
        console.error('GET /api/challenges error', publicResult.error);
        return NextResponse.json({ error: publicResult.error.message }, { status: 500 });
      }

      // If `is_hide` was included in the response, filter client-side as a
      // safety net. Otherwise the server-side `.neq` already filtered results.
      const publicData = (publicResult.data || []).filter((c: any) => c.is_hide !== true);

      return NextResponse.json({ challenges: publicData });
  } catch (err: any) {
    console.error('GET /api/challenges exception', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
