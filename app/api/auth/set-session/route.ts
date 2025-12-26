import { NextRequest, NextResponse } from "next/server";
import serverDebug from '@/lib/server-debug'

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as unknown;
    const parsed = (typeof body === 'object' && body) ? body as Record<string, unknown> : {};
    const access = typeof parsed.access_token === 'string' ? parsed.access_token : undefined;
    const refresh = typeof parsed.refresh_token === 'string' ? parsed.refresh_token : undefined;

    if (!access) {
      return NextResponse.json({ error: 'access_token required' }, { status: 400 });
    }

    // Determine secure flag similar to email-login route
    const forwardedProto = request.headers.get('x-forwarded-proto');
    const isProduction = process.env.NODE_ENV === 'production';
    const proto = forwardedProto || (isProduction ? 'https' : 'http');
    const forceSecure = (process.env.FORCE_COOKIE_SECURE || '').toLowerCase() === 'true';
    const envCookieDomain = process.env.COOKIE_DOMAIN || undefined;
    const isSecure = forceSecure || (proto === 'https' && isProduction);

    const res = NextResponse.json({ ok: true });

    const cookieOptions: Record<string, unknown> = {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    };
    if (envCookieDomain && envCookieDomain.length > 0) cookieOptions.domain = envCookieDomain;

    res.cookies.set('sb-access-token', access, cookieOptions);
    if (refresh) {
      const refreshOpts: Record<string, unknown> = { httpOnly: true, secure: isSecure, sameSite: 'lax', maxAge: 60 * 60 * 24 * 30, path: '/' };
      if (envCookieDomain && envCookieDomain.length > 0) refreshOpts.domain = envCookieDomain;
      res.cookies.set('sb-refresh-token', refresh, refreshOpts);
    }

    // Also set a session JSON cookie to assist server-side reconstruction (matches email-login)
    try {
      const sessionObj = JSON.stringify({
        access_token: access,
        refresh_token: refresh ?? null,
        expires_at: null,
        token_type: 'bearer'
      });
      const sessOpts: Record<string, unknown> = { httpOnly: true, secure: isSecure, sameSite: 'lax', maxAge: 60 * 60 * 24 * 7, path: '/' };
      if (envCookieDomain && envCookieDomain.length > 0) sessOpts.domain = envCookieDomain;
      res.cookies.set('sb-session', sessionObj, sessOpts);
    } catch (e) {
      serverDebug.warn('[set-session] failed to set sb-session cookie', e);
    }

    serverDebug.debug('[set-session] Cookie set successfully');

    return res;
  } catch (err: unknown) {
    serverDebug.error('[set-session] error', err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
