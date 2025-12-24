import { NextResponse, NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import getSupabaseServiceClient from '@/lib/supabase-service-client';
import serverDebug from '@/lib/server-debug'
import ensureAdmin from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

// use shared `ensureAdmin` helper

export async function GET(request: NextRequest) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      serverDebug.error('SUPABASE_SERVICE_ROLE_KEY not configured');
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
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

    await ensureAdmin(supabaseAuth, (n: string) => request.cookies.get(n)?.value);

    const { data, error } = await supabaseAuth
      .from('system_settings')
      .select('key, value, description')
      .order('key', { ascending: true });

    if (error) {
      serverDebug.error('GET /api/admin/settings error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ settings: data || [] });
  } catch (err: unknown) {
    serverDebug.error('GET /api/admin/settings exception', err);
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

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const { key, value } = body || {};
    if (!key || typeof key !== 'string') {
      return NextResponse.json({ error: 'Thiếu khóa' }, { status: 400 });
    }

    const service = getSupabaseServiceClient();

    const upsertPayload: Record<string, unknown> = { key: String(key), value: String(value ?? '') };

    const { data, error } = await service
      .from('system_settings')
      .upsert([upsertPayload], { onConflict: 'key' })
      .select()
      .maybeSingle();

    if (error) {
      serverDebug.error('POST /api/admin/settings error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ setting: data });
  } catch (err: unknown) {
    serverDebug.error('POST /api/admin/settings exception', err);
    const status = (err as Record<string, unknown>)?.status || 500;
    return NextResponse.json({ error: (err as Record<string, unknown>)?.message || String(err) }, { status: typeof status === 'number' ? status : 500 });
  }
}
