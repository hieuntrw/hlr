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

      const { data: parts, error: partError } = await supabase
        .from('challenge_participants')
        .select('challenge_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1000);

      if (partError) {
        console.error('GET /api/challenges participations error', partError);
        return NextResponse.json({ error: partError.message }, { status: 500 });
      }

      // Deduplicate ids and preserve order (first occurrence kept)
      const rawIds = (parts || []).map((p: any) => p.challenge_id).filter(Boolean);
      const seen = new Set<string>();
      const ids: string[] = [];
      for (const id of rawIds) {
        if (!seen.has(id)) {
          seen.add(id);
          ids.push(id);
        }
      }

      if (ids.length === 0) return NextResponse.json({ challenges: [] });

      const { data: challengesData, error: chError } = await supabase
        .from('challenges')
        .select('id, title, start_date, end_date, status, is_locked, created_at')
        .in('id', ids);

      if (chError) {
        console.error('GET /api/challenges error (my)', chError);
        return NextResponse.json({ error: chError.message }, { status: 500 });
      }

      // Fetch participant rows for this user for the returned challenge ids
      const { data: partsData, error: partsError } = await supabase
        .from('challenge_participants')
        .select('challenge_id, total_km, avg_pace_seconds, valid_activities_count, completion_rate, completed')
        .eq('user_id', user.id)
        .in('challenge_id', ids);

      if (partsError) {
        console.error('GET /api/challenges participant rows error', partsError);
        return NextResponse.json({ error: partsError.message }, { status: 500 });
      }

      const challengeMap: Record<string, any> = {};
      (challengesData || []).forEach((c: any) => { challengeMap[c.id] = c; });

      const participantMap: Record<string, any> = {};
      (partsData || []).forEach((r: any) => { participantMap[r.challenge_id] = r; });

      // Merge participant fields into the top-level challenge object and preserve participation order
      const ordered = ids.map((id: string) => {
        const base = challengeMap[id];
        if (!base) return null;
        const part = participantMap[id] || {};
        return {
          ...base,
          // Flatten participant fields onto the challenge root
          total_km: part.total_km ?? null,
          avg_pace_seconds: part.avg_pace_seconds ?? null,
          valid_activities_count: part.valid_activities_count ?? null,
          completion_rate: part.completion_rate ?? null,
          completed: part.completed ?? false,
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
