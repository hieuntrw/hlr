import { NextResponse, NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

async function ensureAdmin(supabaseAuth: any) {
  const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
  if (userError || !user) throw { status: 401, message: 'Không xác thực' };

  const role = (user as any).user_metadata?.role as string | undefined;
  if (!role || role !== 'admin') throw { status: 403, message: 'Không có quyền' };

  return user;
}

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

    const { data, error } = await supabaseAuth
      .from('system_settings')
      .select('key, value, description')
      .order('key', { ascending: true });

    if (error) {
      console.error('GET /api/admin/settings error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ settings: data || [] });
  } catch (err: any) {
    console.error('GET /api/admin/settings exception', err);
    const status = err?.status || 500;
    return NextResponse.json({ error: err?.message || String(err) }, { status });
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

    const body = await request.json();
    const { key, value } = body || {};
    if (!key || typeof key !== 'string') {
      return NextResponse.json({ error: 'Thiếu khóa' }, { status: 400 });
    }

    if (process.env.SUPABASE_SERVICE_ROLE_KEY == null) {
      console.error('SUPABASE_SERVICE_ROLE_KEY not configured');
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const service = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const upsertPayload: any = { key, value: String(value ?? '') };

    const { data, error } = await service
      .from('system_settings')
      .upsert([upsertPayload], { onConflict: 'key' })
      .select()
      .maybeSingle();

    if (error) {
      console.error('POST /api/admin/settings error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ setting: data });
  } catch (err: any) {
    console.error('POST /api/admin/settings exception', err);
    const status = err?.status || 500;
    return NextResponse.json({ error: err?.message || String(err) }, { status });
  }
}
