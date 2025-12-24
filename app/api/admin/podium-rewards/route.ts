import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import getSupabaseServiceClient from '@/lib/supabase-service-client';
import serverDebug from '@/lib/server-debug'
import ensureAdmin from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

// use service-role factory for privileged server-side queries

export async function GET(request: NextRequest) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      serverDebug.error('SUPABASE_SERVICE_ROLE_KEY not configured');
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { cookies: { get(n: string) { return request.cookies.get(n)?.value }, set() {}, remove() {} } });

    await ensureAdmin(supabase, (name: string) => request.cookies.get(name)?.value);

    // configs
    const { data: configs } = await supabase.from('reward_podium_config').select('*').eq('is_active', true).order('podium_type', { ascending: true }).order('rank', { ascending: true });

    // rewards (use service client if available to bypass RLS)
    let rewards = null;
    let serviceClient = null;
    try {
      serviceClient = getSupabaseServiceClient();
    } catch {
      serviceClient = null;
    }
    if (serviceClient) {
      const { data } = await serviceClient.from('member_podium_rewards').select('*, race:races(id,name,date,location), member:profiles(full_name,email)').order('created_at', { ascending: false });
      rewards = data;
    } else {
      const { data } = await supabase.from('member_podium_rewards').select('*, race:races(id,name,date,location), member:profiles(full_name,email)').order('created_at', { ascending: false });
      rewards = data;
    }

    // races
    const { data: races } = await supabase.from('races').select('*').order('date', { ascending: false });

    // members (use service client if possible)
    let members = null;
    if (serviceClient) {
      const { data } = await serviceClient.from('profiles').select('id,full_name,email').order('full_name', { ascending: true });
      members = data;
    } else {
      const { data } = await supabase.from('profiles').select('id,full_name,email').order('full_name', { ascending: true });
      members = data;
    }

    return NextResponse.json({ configs, rewards, races, members });
  } catch (err: unknown) {
    serverDebug.error('[admin/podium-rewards] exception', err);
    const status = (err as Record<string, unknown>)?.status || 500;
    return NextResponse.json({ error: (err as Record<string, unknown>)?.message || String(err) }, { status: typeof status === 'number' ? status : 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Missing body' }, { status: 400 });
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      serverDebug.error('SUPABASE_SERVICE_ROLE_KEY not configured');
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { cookies: { get(n: string) { return request.cookies.get(n)?.value }, set() {}, remove() {} } });
    await ensureAdmin(supabase, (name: string) => request.cookies.get(name)?.value);

    const payload = Array.isArray(body) ? body : [body];
    const { data, error } = await supabase.from('member_podium_rewards').insert(payload).select();
    if (error) {
      serverDebug.error('[admin/podium-rewards] insert error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ inserted: data });
  } catch (err: unknown) {
    serverDebug.error('[admin/podium-rewards] exception', err);
    const status = (err as Record<string, unknown>)?.status || 500;
    return NextResponse.json({ error: (err as Record<string, unknown>)?.message || String(err) }, { status: typeof status === 'number' ? status : 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || !body.id) return NextResponse.json({ error: 'Missing id/body' }, { status: 400 });
    const { id, ...updates } = body;
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      serverDebug.error('SUPABASE_SERVICE_ROLE_KEY not configured');
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { cookies: { get(n: string) { return request.cookies.get(n)?.value }, set() {}, remove() {} } });
    await ensureAdmin(supabase, (name: string) => request.cookies.get(name)?.value);
    const { data, error } = await supabase.from('member_podium_rewards').update(updates).eq('id', id).select();
    if (error) {
      serverDebug.error('[admin/podium-rewards] update error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ updated: data });
  } catch (err: unknown) {
    serverDebug.error('[admin/podium-rewards] exception', err);
    const status = (err as Record<string, unknown>)?.status || 500;
    return NextResponse.json({ error: (err as Record<string, unknown>)?.message || String(err) }, { status: typeof status === 'number' ? status : 500 });
  }
}
