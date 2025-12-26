import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Restore endpoint - returns access_token from HttpOnly cookie for client-side session hydration.
 * 
 * **Security notes**:
 * - Only accessible via same-origin requests (Origin/Referer check)
 * - Returns token to allow client-side `supabase.auth.setSession`
 * - Should NOT be called from external origins
 */
export async function GET(request: Request) {
  try {
    // Security: Check Origin/Referer to prevent cross-origin token theft
    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');
    const host = request.headers.get('host');
    
    // Allow same-origin requests only
    const allowedOrigins = [
      `http://${host}`,
      `https://${host}`,
      // localhost variants for development
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ];
    
    const isSameOrigin = !origin || allowedOrigins.some(allowed => origin.startsWith(allowed));
    const refererOk = !referer || allowedOrigins.some(allowed => referer.startsWith(allowed));
    
    if (!isSameOrigin || !refererOk) {
      console.warn('[auth/restore] Cross-origin request blocked', { origin, referer, host });
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const cookie = request.headers.get('cookie') || '';
    const match = cookie.match(/sb-access-token=([^;\s]+)/);
    if (!match) return NextResponse.json({ ok: false }, { status: 404 });
    const token = decodeURIComponent(match[1]);
    
    // Return with security headers
    return NextResponse.json(
      { ok: true, access_token: token },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'X-Content-Type-Options': 'nosniff',
        }
      }
    );
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
