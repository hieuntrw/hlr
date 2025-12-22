import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import serverDebug from '@/lib/server-debug';
import ensureAdmin from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const start = Date.now();
  serverDebug.debug('[admin/financial-categories] GET start', { url: request.url });
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

    const service = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const url = new URL(request.url);
    const fields = url.searchParams.get('fields') || '*';

    const { data, error } = await service
      .from('financial_categories')
      .select(fields)
      .order('name', { ascending: true });

    if (error) {
      serverDebug.error('Failed to fetch financial_categories', error);
      serverDebug.debug('[admin/financial-categories] duration_ms:', Date.now() - start);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    serverDebug.debug('[admin/financial-categories] GET success count=', Array.isArray(data) ? data.length : 0, 'duration_ms:', Date.now() - start);
    return NextResponse.json({ data });
  } catch (err: unknown) {
    serverDebug.error('Exception in admin financial-categories list', err);
    const status = (err as Record<string, unknown>)?.status || 500;
    return NextResponse.json({ error: (err as Record<string, unknown>)?.message || String(err) }, { status: typeof status === 'number' ? status : 500 });
  }
}
