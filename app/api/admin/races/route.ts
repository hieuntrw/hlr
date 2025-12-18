import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import serverDebug from '@/lib/server-debug';
import ensureAdmin from '@/lib/server-auth';

export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';

// use shared `ensureAdmin` helper

export async function GET(request: NextRequest) {
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

    const service = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
      : null;

    const client = service || supabaseAuth;

    const { data, error } = await client
      .from('races')
      .select('id, name, race_date, location, image_url, race_results(id)')
      .order('race_date', { ascending: false });
    if (error) {
      serverDebug.error('GET /api/admin/races error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const mapped = (data || []).map((r: Record<string, unknown>) => ({
      id: String(r['id'] ?? ''),
      name: String(r['name'] ?? ''),
      race_date: String(r['race_date'] ?? ''),
      location: r['location'] as string | undefined,
      image_url: r['image_url'] as string | undefined,
      participant_count: Array.isArray(r['race_results']) ? (r['race_results'] as unknown[]).length : 0,
    }));

    return NextResponse.json({ data: mapped });
  } catch (err: unknown) {
    serverDebug.error('GET /api/admin/races exception', err);
    const status = (err as Record<string, unknown>)?.status || 500;
    return NextResponse.json({ error: (err as Record<string, unknown>)?.message || String(err) }, { status: typeof status === 'number' ? status : 500 });
  }
}

export async function POST(request: NextRequest) {
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

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      serverDebug.error('SUPABASE_SERVICE_ROLE_KEY not configured');
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Missing body' }, { status: 400 });

    const b = body as Record<string, unknown>;
    const payload = { name: b.name as string, race_date: b.race_date as string, location: b.location as string, image_url: (b.image_url as string) || null };
    const { data, error } = await service.from('races').insert(payload).select().maybeSingle();
    if (error) {
      serverDebug.error('POST /api/admin/races insert error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ data });
  } catch (err: unknown) {
    serverDebug.error('POST /api/admin/races exception', err);
    const status = (err as Record<string, unknown>)?.status || 500;
    return NextResponse.json({ error: (err as Record<string, unknown>)?.message || String(err) }, { status: typeof status === 'number' ? status : 500 });
  }
}
