import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import serverDebug from '@/lib/server-debug';

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  
  try {
    // Support JSON or form submissions
    let email: string | undefined;
    let password: string | undefined;
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = (await request.json()) as unknown;
      const parsed = (typeof body === 'object' && body) ? body as Record<string, unknown> : {};
      email = typeof parsed.email === 'string' ? parsed.email : undefined;
      password = typeof parsed.password === 'string' ? parsed.password : undefined;
    } else {
      const form = await request.formData();
      email = (form.get('email') as string) || undefined;
      password = (form.get('password') as string) || undefined;
    }

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email và mật khẩu là bắt buộc" },
        { status: 400 }
      );
    }

    // Use anon key for authentication
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    serverDebug.debug("Attempting login for:", email);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      serverDebug.error("Login error:", error);
      return NextResponse.json(
        { error: `${error.message}. Tài khoản email hoặc mật khẩu không đúng vui lòng thử lại.` },
        { status: 401 }
      );
    }

    serverDebug.debug("Login successful for:", data.user?.email);

    // Get user's profile to return role information
    // Ensure a minimal profile row exists for this user to avoid PGRST116
    // (single() failing when 0 rows). Attempt to read existing profile first,
    // then insert a minimal one if missing.
    let profile: Record<string, unknown> | null = null;
    try {
      const profileResp = await supabase
        .from("profiles")
        .select("role, full_name")
        .eq("id", data.user.id)
        .single();
      if (profileResp.error) {
        // If no rows found (PGRST116), attempt to create a minimal profile.
        serverDebug.debug('[email-login] profiles single() error:', profileResp.error);
        try {
          const minimal = {
            id: data.user.id,
            full_name: ((data.user.user_metadata as unknown) as Record<string, unknown>)?.fullName || null,
            role: ((data.user.app_metadata as unknown) as Record<string, unknown>)?.role || 'member',
          };
          serverDebug.debug('[email-login] Creating minimal profile for user', data.user.id);
          const upsertResp = await supabase.from('profiles').upsert(minimal).select().single();
          if (upsertResp.error) {
            serverDebug.warn('[email-login] profiles upsert failed', upsertResp.error);
          } else {
            profile = upsertResp.data;
          }
        } catch (upErr) {
          serverDebug.warn('[email-login] unexpected error creating minimal profile', upErr);
        }
      } else {
        profile = profileResp.data;
      }
    } catch (e) {
      serverDebug.warn('[email-login] profiles query unexpected error', e);
    }

    // Prepare response body
    const responseBody = {
      ok: true,
      user: {
        ...data.user,
        role: profile?.role || ((data.user.app_metadata as unknown) as Record<string, unknown>)?.role || "member",
        full_name: profile?.full_name,
      },
    };

    // Create response and set cookies directly on it so Set-Cookie headers
    // are guaranteed to be attached to the returned response.
    const res = NextResponse.json(responseBody);

    // Set access token cookie for middleware authentication
    if (data.session?.access_token) {
      serverDebug.debug("Setting sb-access-token cookie...");
      // Determine whether to set Secure flag based on forwarded proto or environment
      const forwardedProto = request.headers.get('x-forwarded-proto');
      const isProduction = process.env.NODE_ENV === 'production';
      const proto = forwardedProto || (isProduction ? 'https' : 'http');
      // Allow forcing secure via env for edge cases (reverse proxy behavior)
      const forceSecure = (process.env.FORCE_COOKIE_SECURE || '').toLowerCase() === 'true';
      const envCookieDomain = process.env.COOKIE_DOMAIN || undefined;
      const isSecure = forceSecure || (proto === 'https' && isProduction);
      serverDebug.info('cookie proto:', proto, 'isSecure:', isSecure, 'x-forwarded-proto:', forwardedProto, 'forceSecure:', forceSecure, 'cookieDomain:', envCookieDomain);

      const cookieOptions: Record<string, unknown> = {
        httpOnly: true,
        secure: isSecure,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
      };
      if (envCookieDomain && envCookieDomain.length > 0) cookieOptions.domain = envCookieDomain;

      // Attach cookie to the response
      res.cookies.set('sb-access-token', data.session.access_token, cookieOptions);

      // Also set refresh token
      if (data.session?.refresh_token) {
        serverDebug.debug("Setting sb-refresh-token cookie...");
          const refreshOpts: Record<string, unknown> = {
            httpOnly: true,
            secure: isSecure,
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 30, // 30 days
            path: '/',
          };
        if (envCookieDomain && envCookieDomain.length > 0) refreshOpts.domain = envCookieDomain;
        res.cookies.set('sb-refresh-token', data.session.refresh_token, refreshOpts);
      }
      serverDebug.debug("Cookies set successfully (secure=%s)", isSecure);
    } else {
      serverDebug.warn("No access token in session!");
    }

    serverDebug.debug("Returning success response with user:", data.user.email);

    // If this was a form submission (browser navigation), redirect to the
    // requested page so the browser applies the HttpOnly cookies before
    // loading the next page. We detect this by the Accept header preferring
    // HTML or by non-JSON content-type on the request.
    const accept = request.headers.get('accept') || '';
    const redirectTo = new URL(request.url).searchParams.get('redirect') || '/dashboard';
    if (!contentType.includes('application/json') || accept.includes('text/html')) {
      // Use 303 See Other so the browser follows with a GET to the redirect URL
      const redirectResponse = NextResponse.redirect(new URL(redirectTo, request.url), 303);
      // re-set cookies on the redirect response so the browser receives them
      if (data.session?.access_token) {
        const forwardedProto = request.headers.get('x-forwarded-proto');
        const isProduction = process.env.NODE_ENV === 'production';
        const proto = forwardedProto || (isProduction ? 'https' : 'http');
        const forceSecure = (process.env.FORCE_COOKIE_SECURE || '').toLowerCase() === 'true';
        const envCookieDomain = process.env.COOKIE_DOMAIN || undefined;
        const isSecure = forceSecure || (proto === 'https' && isProduction);
        const cookieOptions: Record<string, unknown> = {
          httpOnly: true,
          secure: isSecure,
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7,
          path: '/',
        };
        if (envCookieDomain && envCookieDomain.length > 0) cookieOptions.domain = envCookieDomain;
        redirectResponse.cookies.set('sb-access-token', data.session.access_token, cookieOptions);
        if (data.session?.refresh_token) {
          const refreshOpts: Record<string, unknown> = { httpOnly: true, secure: isSecure, sameSite: 'lax', maxAge: 60 * 60 * 24 * 30, path: '/' };
          if (envCookieDomain && envCookieDomain.length > 0) refreshOpts.domain = envCookieDomain;
          redirectResponse.cookies.set('sb-refresh-token', data.session.refresh_token, refreshOpts);
        }
      }
      return redirectResponse;
    }

    return res;
    } catch (err: unknown) {
      serverDebug.error("Server error:", err);
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { error: message || "Lỗi máy chủ" },
        { status: 500 }
      );
    }
}
