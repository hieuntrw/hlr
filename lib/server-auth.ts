import type { SupabaseClient, User } from '@supabase/supabase-js';
import serverDebug from './server-debug';

async function decodeSbSessionCookie(raw?: string) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw) || '{}') as Record<string, unknown>;
    const accessTok = typeof parsed.access_token === 'string' ? parsed.access_token : undefined;
    if (!accessTok) return null;
    const parts = accessTok.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const padded = payload.padEnd(payload.length + (4 - (payload.length % 4)) % 4, '=');
    const json = Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    const obj = JSON.parse(json) as Record<string, unknown>;
    const sub = typeof obj.sub === 'string' ? obj.sub : (typeof obj.user_id === 'string' ? obj.user_id : null);
    if (!sub) return null;
    const roleFromToken = (obj['app_metadata'] && typeof (obj['app_metadata'] as Record<string, unknown>)['role'] === 'string')
      ? ((obj['app_metadata'] as Record<string, unknown>)['role'] as string)
      : (typeof obj['role'] === 'string' ? (obj['role'] as string) : undefined);
    const finalRole = roleFromToken || 'member';
    const user: Partial<User> = { id: sub, email: null, user_metadata: {}, app_metadata: { role: finalRole } } as unknown as Partial<User>;
    return user as User;
  } catch (e) {
    serverDebug.warn('decodeSbSessionCookie failed', String(e));
    return null;
  }
}

export async function getUserFromAuthClient(
  supabaseAuth: SupabaseClient,
  getCookie?: (name: string) => string | undefined
) {
  // Try normal getUser first
  try {
    const first = await supabaseAuth.auth.getUser();
    if (first?.data?.user) return first.data.user as User;
  } catch (e) {
    serverDebug.debug('getUserFromAuthClient initial getUser error', String(e));
  }

  // If getUser returned nothing, try to set session from cookies (access/refresh)
  if (getCookie) {
    try {
      const access = getCookie('sb-access-token');
      const refresh = getCookie('sb-refresh-token');
      if (access && refresh) {
        serverDebug.debug('getUserFromAuthClient attempting setSession from cookies');
        const setResp = await supabaseAuth.auth.setSession({ access_token: access, refresh_token: refresh });
        serverDebug.debug('getUserFromAuthClient setSession error:', setResp.error?.message ?? null);
        try {
          const retry = await supabaseAuth.auth.getUser();
          if (retry?.data?.user) return retry.data.user as User;
        } catch (e) {
          serverDebug.debug('getUserFromAuthClient retry getUser error', String(e));
        }
      }
    } catch (e) {
      serverDebug.warn('getUserFromAuthClient setSession attempt failed', String(e));
    }

    // If setSession failed (refresh rotation), attempt to reconstruct
    // a minimal user from the `sb-session` cookie's access token payload.
    const sbRaw = getCookie('sb-session');
    if (sbRaw) serverDebug.debug('getUserFromAuthClient sb-session raw preview:', sbRaw.substring(0, 200));
    const reconstructed = await decodeSbSessionCookie(sbRaw);
    if (reconstructed) {
      const rolePreview = ((reconstructed as unknown as Record<string, unknown>)['app_metadata'] as Record<string, unknown> | undefined)?.['role'];
      serverDebug.debug('getUserFromAuthClient reconstructed user from sb-session, id:', reconstructed.id, 'role:', rolePreview);
      return reconstructed as User;
    }
  }

  return null;
}

export async function ensureAdmin(
  supabaseAuth: SupabaseClient,
  getCookie?: (name: string) => string | undefined,
  allowedRoles: string[] = ['admin', 'mod_finance', 'mod_member']
) {
  serverDebug.debug('ensureAdmin: starting');
  if (getCookie) serverDebug.debug('ensureAdmin: cookie preview:', String(getCookie('sb-session') ?? '').substring(0, 200));
  const user = await getUserFromAuthClient(supabaseAuth, getCookie);
  if (!user) {
    // Final fallback: if cookies are available attempt to decode sb-session
    // directly here and honor `app_metadata.role` if present. This mirrors
    // middleware behavior and helps when refresh-token rotation prevents
    // `setSession` from succeeding.
    if (getCookie) {
      try {
        const sbRaw = getCookie('sb-session');
        if (sbRaw) {
          const reconstructed = await decodeSbSessionCookie(sbRaw);
          if (reconstructed) {
              const r = (((reconstructed as unknown as Record<string, unknown>)['app_metadata']) as Record<string, unknown> | undefined)?.['role'] as string | undefined;
              if (r && allowedRoles.includes(r)) {
                serverDebug.debug('ensureAdmin: granted via sb-session fallback, id:', reconstructed.id, 'role:', r);
                return { user: reconstructed as User, role: r };
              }
            }
        }
      } catch (e) {
        serverDebug.warn('ensureAdmin: sb-session fallback failed', String(e));
      }
    }

    serverDebug.warn('ensureAdmin: unauthenticated');
    throw { status: 401, message: 'Không xác thực' };
  }

  const role = (user.app_metadata as Record<string, unknown> | undefined)?.role as string | undefined;
  if (!role || !allowedRoles.includes(role)) {
    serverDebug.warn('ensureAdmin: forbidden', { user: user.id, role });
    throw { status: 403, message: 'Không có quyền' };
  }

  return { user, role };
}

export default ensureAdmin;
