import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import serverDebug from "@/lib/server-debug";

export async function middleware(req: NextRequest) {
  serverDebug.debug("\n[Middleware] ===== NEW REQUEST =====");
  serverDebug.debug("[Middleware] Path:", req.nextUrl.pathname);
  // Log presence/size of raw Cookie header (never print raw cookie contents)
  const rawCookieHeader = req.headers.get("cookie");
  if (rawCookieHeader) {
    serverDebug.debug("[Middleware] Raw Cookie header present, length:", rawCookieHeader.length);
  } else {
    serverDebug.debug("[Middleware] Raw Cookie header: <none>");
  }
  const allCookies = req.cookies.getAll();
  serverDebug.debug("[Middleware] All cookies count:", allCookies.length);
  
  // Find Supabase auth cookies
  const authCookies = allCookies.filter(c => 
    c.name.includes('supabase') || 
    c.name.includes('sb-') ||
    c.name === 'sb-access-token' ||
    c.name === 'sb-refresh-token'
  );
  serverDebug.debug("[Middleware] Auth cookies found:", authCookies.map(c => c.name).join(", "));
  
  const response = NextResponse.next({
    request: {
      headers: req.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          const value = req.cookies.get(name)?.value;
          if (value) {
            serverDebug.debug(`[Middleware] Cookie get: ${name} present (redacted)`);
          }
          return value;
        },
        set(name: string, value: string, options?: Record<string, unknown>) {
          serverDebug.debug(`[Middleware] Cookie set: ${name}`);
          req.cookies.set({
            name,
            value,
            ...(options as Record<string, unknown> | undefined),
          });
          response.cookies.set({
            name,
            value,
            ...(options as Record<string, unknown> | undefined),
          });
        },
        remove(name: string, options?: Record<string, unknown>) {
          serverDebug.debug(`[Middleware] Cookie remove: ${name}`);
          req.cookies.set({
            name,
            value: "",
            ...(options as Record<string, unknown> | undefined),
          });
          response.cookies.set({
            name,
            value: "",
            ...(options as Record<string, unknown> | undefined),
          });
        },
      },
    }
  );

  // Try to get the user from the server client
  let getUserResult = await supabase.auth.getUser();
  let user: any = getUserResult.data.user;
  let authError = getUserResult.error as unknown;

  if (authError) {
    serverDebug.warn("[Middleware] Auth error:", (authError as { message?: string }).message ?? String(authError));
  }
  serverDebug.debug("[Middleware] User:", user?.email || "not authenticated");
  serverDebug.debug("[Middleware] User app_metadata:", (user as unknown as Record<string, unknown>)?.app_metadata);

  // If no user was reconstructed from cookies, attempt to initialize the
  // server client session using the sb- cookies (safe server-side operation)
  // and retry. This mirrors the behavior in `whoami` and avoids unsigned
  // JWT payload decoding in middleware.
  if (!user) {
    // Indicate presence of auth cookies (do not log token contents)
    const accessPresent = !!req.cookies.get('sb-access-token')?.value;
    const refreshPresent = !!req.cookies.get('sb-refresh-token')?.value;
    serverDebug.debug('[Middleware] No user from supabase.auth.getUser(). Auth cookie presence:', { accessPresent, refreshPresent });
    // Log important headers that affect cookie behavior
    serverDebug.debug('[Middleware] x-forwarded-proto:', req.headers.get('x-forwarded-proto'));
    serverDebug.debug('[Middleware] host:', req.headers.get('host'));
    serverDebug.debug('[Middleware] rawCookieHeader length:', rawCookieHeader ? rawCookieHeader.length : 0);
    const access = req.cookies.get('sb-access-token')?.value;
    const refresh = req.cookies.get('sb-refresh-token')?.value;
    if (access && refresh) {
      try {
        serverDebug.debug('[Middleware] Attempting supabase.auth.setSession from cookies');
        const setResp = await supabase.auth.setSession({ access_token: access, refresh_token: refresh });
        serverDebug.debug('[Middleware] setSession result error:', setResp.error?.message || null);
        // Retry getUser
        getUserResult = await supabase.auth.getUser();
        user = getUserResult.data.user;
        authError = getUserResult.error as unknown;
        serverDebug.debug('[Middleware] retry supabase.getUser error:', (authError as { message?: string }).message ?? null);
                serverDebug.debug('[Middleware] retry user:', user?.email || 'not authenticated');
      } catch (e) {
        serverDebug.warn('[Middleware] setSession attempt failed', e);
      }
    }

    // If setSession failed (for example refresh token rotation -> "Already Used"),
    // try to reconstruct a minimal user identity from the `sb-session` cookie
    // (same safe fallback used in /api/auth/whoami). This allows middleware to
    // authorize routes based on `app_metadata.role` when the access token JWT
    // is still valid even if refresh token cannot be used.
    if (!user) {
      const sess = req.cookies.get('sb-session')?.value;
      if (sess) {
        try {
          const parsed = JSON.parse(decodeURIComponent(sess) || '{}') as Record<string, unknown>;
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
                  } as unknown;
                  serverDebug.info('[Middleware] reconstructed user from sb-session (read-only): id=%s role=%s', String(sub), String(finalRole));
                }
              } catch (e) {
                serverDebug.warn('[Middleware] failed to decode/access token payload', String(e));
              }
            }
          }
        } catch (e) {
          serverDebug.warn('[Middleware] failed to parse sb-session cookie', String(e));
        }
      }
    }

    if (!user) {
      // Redirect to login when no user is present. This preserves security and
      // avoids using an unverified JWT payload as an authoritative identity.
      const redirectUrl = new URL('/login', req.url);
      redirectUrl.searchParams.set('redirect', req.nextUrl.pathname);
      return NextResponse.redirect(redirectUrl);
    }
  }

  // Check if the route is an admin route
  if (req.nextUrl.pathname.startsWith("/admin")) {
    // Middleware must be fast. Use server-controlled `app_metadata` for role only.
    // Avoid DB lookups here (can timeout). Defer DB-based role resolution to server/SSR routes or client-side components.
    const role = (user as unknown as { app_metadata?: { role?: string } })?.app_metadata?.role as string | undefined;
    serverDebug.debug("[Middleware] User role (app_metadata only):", role);

    const validRoles = ["admin", "mod_finance", "mod_challenge", "mod_member"];
    if (!role || !validRoles.includes(role)) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    // Role-based access control for specific admin routes
    const path = req.nextUrl.pathname;
    if (
      (path.startsWith("/admin/finance") || path === "/admin/finance-report") &&
      !["admin", "mod_finance"].includes(role)
    ) {
      return NextResponse.redirect(new URL("/admin", req.url));
    }
    if (path.startsWith("/admin/challenges") && !["admin", "mod_challenge"].includes(role)) {
      return NextResponse.redirect(new URL("/admin", req.url));
    }
    if (
      (path.startsWith("/admin/members") || path.startsWith("/admin/pb-approval")) &&
      !["admin", "mod_member"].includes(role)
    ) {
      return NextResponse.redirect(new URL("/admin", req.url));
    }
    if (path.startsWith("/admin/settings") && role !== "admin") {
      return NextResponse.redirect(new URL("/admin", req.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Only protect admin routes with middleware
    "/admin/:path*",
  ],
};
