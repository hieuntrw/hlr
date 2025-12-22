/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import serverDebug from '@/lib/server-debug';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const cookieStore = cookies();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
            set(_name: string, _value: string) {
              // set via NextResponse below; no-op here
            },
            remove(_name: string) {
              // no-op
            },
        },
      }
    );

    // Try server-side sign out to revoke refresh token if possible
    try {
      const { error } = await supabase.auth.signOut();
      if (error) serverDebug.warn('[logout] supabase.signOut error:', error.message);
    } catch (e) {
      serverDebug.warn('[logout] signOut failed', String(e));
    }

    const res = NextResponse.json({ ok: true });

    // Clear known Supabase auth cookies
    const cookieNames = ['sb-access-token', 'sb-refresh-token', 'sb-session', 'supabase-auth-token'];
    cookieNames.forEach((name) => {
      try {
        res.cookies.set(name, '', { path: '/', expires: new Date(0) });
      } catch {
        // ignore
      }
    });

    // Also clear any cookie starting with 'sb-' present in incoming store
    try {
      cookieStore.getAll().forEach(c => {
        if (c.name && c.name.startsWith('sb-')) {
          try { res.cookies.set(c.name, '', { path: '/', expires: new Date(0) }); } catch {}
        }
      });
    } catch {}

    return res;
  } catch (err: unknown) {
    serverDebug.error('[logout] error', String(err));
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}