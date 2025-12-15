import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import serverDebug from '@/lib/server-debug';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  try {
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

    const { data, error } = await supabase
      .from('challenges')
      .select('id, title, start_date, end_date, description, is_locked, capacity, created_by, min_pace_seconds, max_pace_seconds')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      serverDebug.error('GET /api/challenges/[id] error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ challenge: data });
  } catch (err: unknown) {
    serverDebug.error('GET /api/challenges/[id] exception', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
