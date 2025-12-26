import { NextResponse, NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import serverDebug from '@/lib/server-debug';
import { requireAdminFromRequest } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
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

    await requireAdminFromRequest((n: string) => request.cookies.get(n)?.value);
    // use shared `ensureAdmin` helper

    const body = await request.json();
    const { lock } = body;
    if (typeof lock !== 'boolean') {
      return NextResponse.json({ error: 'Missing lock boolean' }, { status: 400 });
    }

    const { data, error } = await supabaseAuth
      .from('challenges')
      .update({ is_locked: lock })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) {
      serverDebug.error('POST /api/admin/challenges/[id]/lock error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ challenge: data });
  } catch (err: unknown) {
    serverDebug.error('POST /api/admin/challenges/[id]/lock exception', err);
    const status = (err as Record<string, unknown>)?.status || 500;
    return NextResponse.json({ error: (err as Record<string, unknown>)?.message || String(err) }, { status: typeof status === 'number' ? status : 500 });
  }
}
