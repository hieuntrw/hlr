import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import serverDebug from '@/lib/server-debug';
import ensureAdmin from '@/lib/server-auth';

export const dynamic = 'force-dynamic';


// use shared `ensureAdmin` helper

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
    // Sanitize updates: allow only known race_results columns
    const allowedUpdateKeys = ['distance', 'chip_time_seconds', 'podium_config_id', 'is_pr', 'status'];
    const cleanUpdates: Record<string, unknown> = {};
    if (updates) {
      for (const k of allowedUpdateKeys) {
        if (k in updates) cleanUpdates[k] = updates[k as keyof typeof updates];
      }
    }

    const service = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
      : null;

    const client = service || supabaseAuth;

    const { data, error } = await client.from('race_results').update(cleanUpdates).eq('id', id).select().maybeSingle();
    if (error) {
      serverDebug.error('PUT /api/admin/race-results update error', error);
      const errObj = error as unknown as Record<string, unknown>;
      const msg = errObj && typeof errObj.message === 'string'
        ? (errObj.message as string)
        : String(error || 'Unknown error');
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    return NextResponse.json({ updated: data });
  } catch (err: unknown) {
    serverDebug.error('PUT /api/admin/race-results exception', err);
    const status = (err as Record<string, unknown>)?.status || 500;
    return NextResponse.json({ error: (err as Record<string, unknown>)?.message || String(err) }, { status: typeof status === 'number' ? status : 500 });
  }
}

export async function DELETE(request: NextRequest) {
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

    const service = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
      : null;

    const client = service || supabaseAuth;

    const { error } = await client.from('race_results').delete().eq('id', id);
    if (error) {
      serverDebug.error('DELETE /api/admin/race-results delete error', error);
      const errObj = error as unknown as Record<string, unknown>;
      const msg = errObj && typeof errObj.message === 'string'
        ? (errObj.message as string)
        : String(error || 'Unknown error');
      const detail = typeof errObj.details === 'string'
        ? `: ${(errObj.details as string)}`
        : '';
      return NextResponse.json({ error: `${msg}${detail}` }, { status: 500 });
    }

    return NextResponse.json({ deleted: id });
  } catch (err: unknown) {
    serverDebug.error('DELETE /api/admin/race-results exception', err);
    const status = (err as Record<string, unknown>)?.status || 500;
    const msg = (err && (err as Record<string, unknown>)?.message) ? (err as Record<string, unknown>)?.message : String(err ?? 'Unknown error');
    return NextResponse.json({ error: msg }, { status: typeof status === 'number' ? status : 500 });
  }
}
