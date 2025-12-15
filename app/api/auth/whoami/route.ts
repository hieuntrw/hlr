import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import serverDebug from '@/lib/server-debug'

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cookieStore = cookies();

    // Debug: log incoming cookies
    const incoming = cookieStore.getAll().map(c => ({ name: c.name, valuePreview: c.value?.substring(0, 50) }));
    serverDebug.debug('[whoami] incoming cookies:', incoming);
    // Also log specific auth cookie previews
    const accPreview = cookieStore.get('sb-access-token')?.value?.substring(0, 120) || null;
    const refPreview = cookieStore.get('sb-refresh-token')?.value?.substring(0, 120) || null;
    serverDebug.debug('[whoami] sb-access-token preview:', accPreview);
    serverDebug.debug('[whoami] sb-refresh-token preview:', refPreview);

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set() {
            // not used here
          },
          remove() {
            // not used here
          },
        },
      }
    );

    const getUserResp = await supabase.auth.getUser();
    let user = getUserResp.data.user;
    let error = getUserResp.error;
    serverDebug.debug('[whoami] initial supabase.getUser error:', error ? error.message : null);

    // If supabase did not reconstruct the session from cookies, but cookies are present,
    // initialize the server client session directly using the tokens. This is safe
    // in a server-side context and avoids relying on unsigned JWT payload decoding.
    if (!user && (accPreview || refPreview)) {
      try {
        serverDebug.debug('[whoami] Attempting supabase.auth.setSession from cookies');
        const access = cookieStore.get('sb-access-token')?.value;
        const refresh = cookieStore.get('sb-refresh-token')?.value;
        if (access && refresh) {
          const setResp = await supabase.auth.setSession({ access_token: access, refresh_token: refresh });
          serverDebug.debug('[whoami] setSession result error:', setResp.error?.message || null);
        } else {
          serverDebug.warn('[whoami] incomplete auth cookies present; skipping setSession');
        }
        // Try getUser again
        const retry = await supabase.auth.getUser();
        user = retry.data.user;
        error = retry.error || null;
        serverDebug.debug('[whoami] retry supabase.getUser error:', error ? error.message : null);
      } catch (e) {
        serverDebug.warn('[whoami] setSession attempt failed', String(e));
      }
    }
    if (!user) {
      const msg = error ? (error.message || String(error)) : 'Auth session missing!';
      return NextResponse.json({ ok: false, error: msg, cookies: cookieStore.getAll().map(c => ({ name: c.name, preview: c.value?.substring(0, 50) })), tokenPreviews: { access: accPreview, refresh: refPreview } }, { status: 200 });
    }

    return NextResponse.json({ ok: true, user: user, cookies: cookieStore.getAll().map(c => ({ name: c.name, preview: c.value?.substring(0, 50) })), tokenPreviews: { access: accPreview, refresh: refPreview } });
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
