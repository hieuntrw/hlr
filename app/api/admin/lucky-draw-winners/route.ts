import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import serverDebug from '@/lib/server-debug';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { get(n: string) { return request.cookies.get(n)?.value }, set() {}, remove() {} } });
    const { data: challenges } = await supabase.from('challenges').select('id, name, month, year').order('year', { ascending: false }).order('month', { ascending: false });
    const { data: winners } = await supabase.from('lucky_draw_winners').select('*, challenge:challenges(id,name,month,year), member:profiles(full_name,email)').order('created_at', { ascending: false });
    const { data: members } = await supabase.from('profiles').select('id,full_name,email').order('full_name', { ascending: true });
    return NextResponse.json({ challenges, winners, members });
  } catch (err: unknown) {
    serverDebug.error('[admin/lucky-draw-winners] exception', err);
    const status = (err as Record<string, unknown>)?.status || 500;
    return NextResponse.json({ error: (err as Record<string, unknown>)?.message || String(err) }, { status: typeof status === 'number' ? status : 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Missing body' }, { status: 400 });
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { get(n: string) { return request.cookies.get(n)?.value }, set() {}, remove() {} } });
    const payload = Array.isArray(body) ? body : [body];
    const { data, error } = await supabase.from('lucky_draw_winners').insert(payload).select();
    if (error) {
      serverDebug.error('[admin/lucky-draw-winners] insert error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ inserted: data });
  } catch (err: unknown) {
    serverDebug.error('[admin/lucky-draw-winners] exception', err);
    const status = (err as Record<string, unknown>)?.status || 500;
    return NextResponse.json({ error: (err as Record<string, unknown>)?.message || String(err) }, { status: typeof status === 'number' ? status : 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || !body.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const { id, ...updates } = body;
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { get(n: string) { return request.cookies.get(n)?.value }, set() {}, remove() {} } });
    const { data, error } = await supabase.from('lucky_draw_winners').update(updates).eq('id', id).select();
    if (error) {
      serverDebug.error('[admin/lucky-draw-winners] update error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ updated: data });
  } catch (err: unknown) {
    serverDebug.error('[admin/lucky-draw-winners] exception', err);
    const status = (err as Record<string, unknown>)?.status || 500;
    return NextResponse.json({ error: (err as Record<string, unknown>)?.message || String(err) }, { status: typeof status === 'number' ? status : 500 });
  }
}
