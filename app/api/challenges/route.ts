import { NextResponse, NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') || '0');
    const pageSize = Number(url.searchParams.get('pageSize') || '12');
    const myParam = url.searchParams.get('my');
    let my = myParam === 'true';
    const start = page * pageSize;
    const end = start + pageSize - 1;

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
      if (ids.length === 0) return NextResponse.json({ challenges: [], page, pageSize, hasMore: false });

        // Paginate client-side over the list of participation ids to avoid
        // sending very large `IN (...)` clauses to Postgres. This also keeps
        // the ordering consistent with `challenge_participants.created_at`.
        const total = ids.length;
        const totalPages = Math.ceil(total / pageSize);
        const hasMore = ids.length > (page + 1) * pageSize;

        const pageIds = ids.slice(start, end + 1);
        if (pageIds.length === 0) return NextResponse.json({ challenges: [], page, pageSize, hasMore, total, totalPages });

        const { data, error } = await supabase
          .from('challenges')
          .select('id, title, start_date, end_date, status, is_locked, created_at')
          .in('id', pageIds);

        if (error) {
          console.error('GET /api/challenges error (my)', error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Order results to match pageIds
        const dataMap: Record<string, any> = {};
        (data || []).forEach((d: any) => { dataMap[d.id] = d; });
        const ordered = pageIds.map((id: string) => dataMap[id]).filter(Boolean);
        return NextResponse.json({ challenges: ordered, page, pageSize, hasMore, total, totalPages });
    }

    // Public listing
    const { data, error } = await supabase
      .from('challenges')
      .select('id, title, start_date, end_date, status, is_locked, created_at')
      .order('start_date', { ascending: false })
      .range(start, end);

    if (error) {
      console.error('GET /api/challenges error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get total count (exact) for clients that need it
    let total = 0;
    try {
      const countRes = await supabase.from('challenges').select('id', { count: 'exact', head: true });
      // supabase-js returns `count` on the response object when head=true
      // @ts-ignore
      total = countRes?.count ?? 0;
    } catch (e) {
      console.warn('Could not fetch total count for challenges', e);
    }

    const hasMore = (data || []).length === pageSize;
    const totalPages = Math.ceil((total || 0) / pageSize);
    return NextResponse.json({ challenges: data || [], page, pageSize, hasMore, total, totalPages });
  } catch (err: any) {
    console.error('GET /api/challenges exception', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
