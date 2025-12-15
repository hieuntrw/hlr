import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import serverDebug from '@/lib/server-debug'
import ensureAdmin from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

async function getServiceClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// use shared `ensureAdmin` helper

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get(name: string) { return request.cookies.get(name)?.value }, set() {}, remove() {} } }
    );

    // reward_definitions is public-read in RLS but keep server-side control
    const { data, error } = await supabase
      .from('reward_definitions')
      .select('*')
      .order('category', { ascending: true })
      .order('priority_level', { ascending: true });

    if (error) {
      serverDebug.error('[admin/reward-definitions] list error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err: unknown) {
    serverDebug.error('[admin/reward-definitions] exception', err);
    const status = (err as Record<string, unknown>)?.status || 500;
    return NextResponse.json({ error: (err as Record<string, unknown>)?.message || String(err) }, { status: typeof status === 'number' ? status : 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: 'Missing body' }, { status: 400 });

    // admin only
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get(name: string) { return request.cookies.get(name)?.value }, set() {}, remove() {} } }
    );
    await ensureAdmin(supabaseAuth);

    // use service role to insert/update unrestricted data when available
    const service = await getServiceClient();
    const client = service || supabaseAuth;

    const payload = Array.isArray(body) ? body : [body];
    const { data, error } = await client.from('reward_definitions').insert(payload).select();
    if (error) {
      serverDebug.error('[admin/reward-definitions] insert error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ inserted: data });
  } catch (err: unknown) {
    serverDebug.error('[admin/reward-definitions] exception', err);
    const status = (err as Record<string, unknown>)?.status || 500;
    return NextResponse.json({ error: (err as Record<string, unknown>)?.message || String(err) }, { status: typeof status === 'number' ? status : 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || !body.id) return NextResponse.json({ error: 'Missing id/body' }, { status: 400 });

    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get(name: string) { return request.cookies.get(name)?.value }, set() {}, remove() {} } }
    );
    await ensureAdmin(supabaseAuth);

    const service = await getServiceClient();
    const client = service || supabaseAuth;

    const { id, ...updates } = body as Record<string, unknown>;
    const { data, error } = await client.from('reward_definitions').update(updates).eq('id', id).select();
    if (error) {
      serverDebug.error('[admin/reward-definitions] update error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ updated: data });
  } catch (err: unknown) {
    serverDebug.error('[admin/reward-definitions] exception', err);
    const status = (err as Record<string, unknown>)?.status || 500;
    return NextResponse.json({ error: (err as Record<string, unknown>)?.message || String(err) }, { status: typeof status === 'number' ? status : 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get(name: string) { return request.cookies.get(name)?.value }, set() {}, remove() {} } }
    );
    await ensureAdmin(supabaseAuth);

    const service = await getServiceClient();
    const client = service || supabaseAuth;

    const { data, error } = await client.from('reward_definitions').delete().eq('id', id).select();
    if (error) {
      serverDebug.error('[admin/reward-definitions] delete error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ deleted: data });
  } catch (err: unknown) {
    serverDebug.error('[admin/reward-definitions] exception', err);
    const status = (err as Record<string, unknown>)?.status || 500;
    return NextResponse.json({ error: (err as Record<string, unknown>)?.message || String(err) }, { status: typeof status === 'number' ? status : 500 });
  }
}
