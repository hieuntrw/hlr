import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import serverDebug from '@/lib/server-debug'

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get(name: string) { return request.cookies.get(name)?.value; }, set() {}, remove() {} } }
    );

    const { data, error } = await supabase
      .from('reward_milestones')
      .select('*')
      .order('race_type', { ascending: true })
      .order('gender', { ascending: true })
      .order('priority', { ascending: true });

    if (error) {
      serverDebug.error('[admin/reward-milestones] list error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err: unknown) {
    serverDebug.error('[admin/reward-milestones] exception', err);
    const status = (err as Record<string, unknown>)?.status || 500;
    return NextResponse.json({ error: (err as Record<string, unknown>)?.message || String(err) }, { status: typeof status === 'number' ? status : 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: 'Missing body' }, { status: 400 });

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get(name: string) { return request.cookies.get(name)?.value; }, set() {}, remove() {} } }
    );
    const { data, error } = await supabase.from('reward_milestones').insert(Array.isArray(body) ? body : [body]).select();
    if (error) {
      serverDebug.error('[admin/reward-milestones] insert error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ inserted: data });
  } catch (err: unknown) {
    serverDebug.error('[admin/reward-milestones] exception', err);
    const status = (err as Record<string, unknown>)?.status || 500;
    return NextResponse.json({ error: (err as Record<string, unknown>)?.message || String(err) }, { status: typeof status === 'number' ? status : 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || !body.id) return NextResponse.json({ error: 'Missing id/body' }, { status: 400 });

    const { id, ...updates } = body;
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get(name: string) { return request.cookies.get(name)?.value; }, set() {}, remove() {} } }
    );

    const { data, error } = await supabase.from('reward_milestones').update(updates).eq('id', id).select();
    if (error) {
      serverDebug.error('[admin/reward-milestones] update error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ updated: data });
  } catch (err: unknown) {
    serverDebug.error('[admin/reward-milestones] exception', err);
    const status = (err as Record<string, unknown>)?.status || 500;
    return NextResponse.json({ error: (err as Record<string, unknown>)?.message || String(err) }, { status: typeof status === 'number' ? status : 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get(name: string) { return request.cookies.get(name)?.value; }, set() {}, remove() {} } }
    );

    const { data, error } = await supabase.from('reward_milestones').delete().eq('id', id).select();
    if (error) {
      serverDebug.error('[admin/reward-milestones] delete error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ deleted: data });
  } catch (err: unknown) {
    serverDebug.error('[admin/reward-milestones] exception', err);
    const status = (err as Record<string, unknown>)?.status || 500;
    return NextResponse.json({ error: (err as Record<string, unknown>)?.message || String(err) }, { status: typeof status === 'number' ? status : 500 });
  }
}
