import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import serverDebug from '@/lib/server-debug';
import { requireAdminFromRequest } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Require admin access - this endpoint exposes user data by email
    await requireAdminFromRequest((name: string) => request.cookies.get(name)?.value);

    const url = new URL(request.url);
    const email = url.searchParams.get('email');
    if (!email) return NextResponse.json({ ok: false, error: 'Missing email' }, { status: 400 });

    // Prefer service-role admin client when available
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
    if (SUPABASE_URL && SERVICE_KEY) {
      const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data, error } = await admin.from('profiles').select('*').eq('email', email).maybeSingle();
      if (error) {
        serverDebug.error('[profiles.by-email] admin lookup failed', error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true, profile: data ?? null });
    }

    // Fallback to server client (requires cookies/auth)
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get(name: string) { return request.cookies.get(name)?.value; }, set() {}, remove() {} } }
    );

    const { data, error } = await supabase.from('profiles').select('*').eq('email', email).maybeSingle();
    if (error) {
      serverDebug.error('[profiles.by-email] anon lookup failed', error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, profile: data ?? null });
  } catch (err: unknown) {
    serverDebug.error('[profiles.by-email] exception', String(err));
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
