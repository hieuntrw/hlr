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

      const ids = (parts || []).map((p: any) => p.challenge_id).filter(Boolean);
        const total = ids.length;
        if (total === 0) return NextResponse.json({ challenges: [] });

        const { data, error } = await supabase
          .from('challenges')
          .select('id, title, start_date, end_date, status, is_locked, created_at')
          .in('id', ids);

        if (error) {
          console.error('GET /api/challenges error (my)', error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Order results to match participation order
        const dataMap: Record<string, any> = {};
        (data || []).forEach((d: any) => { dataMap[d.id] = d; });
        const ordered = ids.map((id: string) => dataMap[id]).filter(Boolean);
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
