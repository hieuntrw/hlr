import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import serverDebug from '@/lib/server-debug'

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cookieStore = cookies();

    const incoming = cookieStore.getAll().map(c => ({ name: c.name, valuePreview: c.value?.substring(0, 50) }));
    serverDebug.debug('[whoami] incoming cookies:', incoming);
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
            /* not used */
          },
          remove() {
            /* not used */
          },
        },
      }
    );

    // Try to get user via supabase server client
    const getUserResp = await supabase.auth.getUser();
    let user: unknown = getUserResp.data.user ?? null;
    let error = getUserResp.error ?? null;
    serverDebug.debug('[whoami] initial supabase.getUser error:', error ? error.message : null);

    // If no user but cookies exist, try to set session from token cookies and retry
    if (!user && (accPreview || refPreview)) {
      try {
        serverDebug.debug('[whoami] Attempting supabase.auth.setSession from cookies');
        const access = cookieStore.get('sb-access-token')?.value;
        const refresh = cookieStore.get('sb-refresh-token')?.value;
        if (access && refresh) {
          const setResp = await supabase.auth.setSession({ access_token: access, refresh_token: refresh });
          serverDebug.debug('[whoami] setSession result:', setResp);
        } else {
          serverDebug.warn('[whoami] incomplete auth cookies present; skipping setSession');
        }
        const retry = await supabase.auth.getUser();
        serverDebug.debug('[whoami] retry supabase.getUser result:', retry);
        user = retry.data.user ?? null;
        error = retry.error ?? null;
      } catch (e) {
        serverDebug.warn('[whoami] setSession attempt failed', String(e));
      }
    }

    // Final fallback: if still no user, try to parse sb-session cookie and extract id/role from JWT payload
    if (!user) {
      const sess = cookieStore.get('sb-session')?.value;
      if (sess) {
        try {
          const parsed = JSON.parse(sess || '{}') as Record<string, unknown>;
          const accessTok = typeof parsed.access_token === 'string' ? parsed.access_token : undefined;
          if (accessTok) {
            const parts = accessTok.split('.');
            if (parts.length === 3) {
              try {
                const payload = parts[1];
                const padded = payload.padEnd(payload.length + (4 - (payload.length % 4)) % 4, '=');
                const json = Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
                const obj = JSON.parse(json) as Record<string, unknown>;
                const sub = typeof obj.sub === 'string' ? obj.sub : (typeof obj.user_id === 'string' ? obj.user_id : null);
                if (sub) {
                  const roleFromToken = (obj['app_metadata'] && typeof (obj['app_metadata'] as Record<string, unknown>)['role'] === 'string')
                    ? ((obj['app_metadata'] as Record<string, unknown>)['role'] as string)
                    : (typeof obj['role'] === 'string' ? (obj['role'] as string) : undefined);
                  const finalRole = roleFromToken || 'member';
                  user = {
                    id: sub,
                    email: null,
                    user_metadata: {},
                    app_metadata: { role: finalRole },
                  };
                  serverDebug.debug('[whoami] reconstructed user from sb-session, id:', sub, 'role:', finalRole);
                }
              } catch (e) {
                serverDebug.warn('[whoami] failed to decode/access token payload', String(e));
              }
            }
          }
        } catch (e) {
          serverDebug.warn('[whoami] failed to parse sb-session cookie', String(e));
        }
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
