import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import serverDebug from '@/lib/server-debug';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const bodyRaw = await request.json().catch(() => null) as unknown;
    if (!bodyRaw) return NextResponse.json({ error: 'Missing body' }, { status: 400 });

    const items = Array.isArray(bodyRaw) ? bodyRaw as unknown[] : [bodyRaw as unknown];

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

    // Reconstruct session/user using shared helper
    const { getUserFromAuthClient } = await import('@/lib/server-auth');
    const user = await getUserFromAuthClient(supabase, (name: string) => request.cookies.get(name)?.value);
    if (!user) return NextResponse.json({ error: 'Không xác thực' }, { status: 401 });

    // Attach user_id if missing to ensure records belong to the authenticated user
    const payload = items.map((it: unknown) => ({ user_id: user.id, ...((typeof it === 'object' && it) ? it as Record<string, unknown> : {}) }));

    const { data, error } = await supabase
      .from('pb_history')
      .insert(payload)
      .select();

    if (error) {
      serverDebug.error('[pb-history] insert error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ inserted: data });
  } catch (err: unknown) {
    serverDebug.error('[pb-history] exception', String(err));
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
