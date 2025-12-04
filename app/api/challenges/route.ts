import { NextResponse, NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') || '0');
    const pageSize = Number(url.searchParams.get('pageSize') || '12');
    const my = url.searchParams.get('my') === 'true';
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

      const { data, error } = await supabase
        .from('challenges')
        .select('id, title, start_date, end_date, status, is_locked, created_at')
        .in('id', ids)
        .order('start_date', { ascending: false })
        .range(start, end);

      if (error) {
        console.error('GET /api/challenges error (my)', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const total = ids.length;
      const totalPages = Math.ceil(total / pageSize);
      const hasMore = ids.length > (page + 1) * pageSize;
      return NextResponse.json({ challenges: data || [], page, pageSize, hasMore, total, totalPages });
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
