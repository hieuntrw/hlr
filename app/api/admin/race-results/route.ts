import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import serverDebug from '@/lib/server-debug';

export const dynamic = 'force-dynamic';

import type { SupabaseClient } from '@supabase/supabase-js';

async function ensureAdmin(supabaseAuth: SupabaseClient) {
  const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
  if (userError || !user) throw { status: 401, message: 'Không xác thực' };

  const { data: profile } = await supabaseAuth
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const role = profile?.role;
  if (!role || !['admin', 'mod_race'].includes(role)) throw { status: 403, message: 'Không có quyền' };
  return { user, role };
}

export async function PUT(request: NextRequest) {
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

    await ensureAdmin(supabaseAuth);

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || !body.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const id = String(body.id);
    const updates = body.updates as Record<string, unknown> | undefined;

    const service = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
      : null;

    const client = service || supabaseAuth;

    const { data, error } = await client.from('race_results').update(updates).eq('id', id).select().maybeSingle();
    if (error) {
      serverDebug.error('PUT /api/admin/race-results update error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ updated: data });
  } catch (err: unknown) {
    serverDebug.error('PUT /api/admin/race-results exception', err);
    const status = (err as Record<string, unknown>)?.status || 500;
    return NextResponse.json({ error: (err as Record<string, unknown>)?.message || String(err) }, { status: typeof status === 'number' ? status : 500 });
  }
}
