import type { SupabaseClient, User } from '@supabase/supabase-js';
import serverDebug from './server-debug';

/**
 * Decode and parse the `sb-session` or raw `sb-access-token` cookie to reconstruct 
 * a minimal User object. **Warning**: This does NOT verify JWT signature - it only 
 * parses the payload. Use only for read-only/UI operations.
 */
export async function decodeSbSessionCookie(raw?: string) {
  if (!raw) return null;
  try {
    // support either a URL-encoded JSON session payload (sb-session)
    // or a raw JWT access token (sb-access-token)
    let accessTok: string | undefined;
    const maybe = decodeURIComponent(raw);
    if (maybe.includes('.') && maybe.split('.').length === 3) {
      accessTok = maybe; // raw JWT
    } else {
      const parsed = JSON.parse(maybe || '{}') as Record<string, unknown>;
      accessTok = typeof parsed.access_token === 'string' ? parsed.access_token : undefined;
    }
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

/**
 * Get authenticated user from Supabase auth client.
 * 
 * Flow:
 * 1. Try `supabase.auth.getUser()` directly
 * 2. If fails and cookies available, attempt `setSession` from cookies and retry
 * 3. **Fallback (READ-ONLY)**: Parse `sb-session` cookie to reconstruct minimal user
 * 
 * **IMPORTANT**: The fallback is NOT cryptographically verified. It's suitable for:
 * - Read-only operations (fetching own profile, viewing data)
 * - UI rendering purposes
 * 
 * For mutations (password change, etc.), the actual Supabase auth call (like 
 * `updateUser`) will fail if there's no real session - this provides a secondary
 * security layer. For admin/privileged operations, use `ensureAdmin()` instead.
 * 
 * @param strictMode - If true, do NOT use sb-session fallback (throws 401 if no valid session)
 */
export async function getUserFromAuthClient(
  supabaseAuth: SupabaseClient,
  getCookie?: (name: string) => string | undefined,
  strictMode: boolean = false
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
        if (setResp.error) {
          serverDebug.debug('getUserFromAuthClient setSession error:', setResp.error.message ?? String(setResp.error));
        } else {
          serverDebug.debug('getUserFromAuthClient setSession succeeded');
        }
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

    // Strict mode: do NOT use sb-session fallback
    if (strictMode) {
      serverDebug.debug('getUserFromAuthClient: strictMode enabled, skipping sb-session fallback');
      return null;
    }

    // Fallback (READ-ONLY): Parse sb-session cookie - NOT verified, use with caution
    const sbRaw = getCookie('sb-session');
    if (sbRaw) serverDebug.debug('getUserFromAuthClient sb-session cookie present (redacted)');
    const reconstructed = await decodeSbSessionCookie(sbRaw);
    if (reconstructed) {
      const rolePreview = ((reconstructed as unknown as Record<string, unknown>)['app_metadata'] as Record<string, unknown> | undefined)?.['role'];
      serverDebug.info('getUserFromAuthClient reconstructed user from sb-session (read-only): id=%s role=%s', String(reconstructed.id), String(rolePreview));
      // Persistent audit: attempt to record reconstruction event to `auth_audit_logs` if service key available.
      try {
        // Lazy import to avoid circular deps at module load
        const getServiceClient = (await import('./supabase-service-client')).default as (() => SupabaseClient) | undefined;
        if (getServiceClient) {
          try {
            const service = getServiceClient();
            // Best-effort insert; do not throw on failure
            await service.from('auth_audit_logs').insert({
              user_id: reconstructed.id,
              action: 'reconstruction_from_sb_session',
              detail: JSON.stringify({ role: rolePreview ?? null }),
              created_at: new Date().toISOString(),
            });
          } catch (e) {
            serverDebug.debug('auth_audit_logs insert failed (non-fatal)', String(e));
          }
        }
      } catch (e) {
        serverDebug.debug('auth audit write failed (non-fatal)', String(e));
      }
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
  serverDebug.debug('ensureAdmin: starting (strict)');
  if (getCookie) serverDebug.debug('ensureAdmin: cookie preview available');

  
  try {
    // 1) quick getUser()
    try {
      const direct = await supabaseAuth.auth.getUser();
      if (direct?.data?.user) {
        const user = direct.data.user as User;
        const role = (user.app_metadata as Record<string, unknown> | undefined)?.role as string | undefined;
        if (!role || !allowedRoles.includes(role)) {
          serverDebug.warn('ensureAdmin: forbidden', { user: user.id, role });
          throw { status: 403, message: 'Không có quyền' };
        }
        return { user, role };
      }
    } catch (e) {
      serverDebug.debug('ensureAdmin: initial getUser() failed', String(e));
    }

    // 2) Attempt to recover session via refresh tokens (if provided)
    if (getCookie) {
      try {
        const access = getCookie('sb-access-token');
        const refresh = getCookie('sb-refresh-token');
        if (access && refresh) {
          serverDebug.debug('ensureAdmin: attempting setSession from cookies');
          const setResp = await supabaseAuth.auth.setSession({ access_token: access, refresh_token: refresh });
          if (setResp.error) {
            serverDebug.warn('ensureAdmin: setSession from cookies failed', setResp.error.message ?? String(setResp.error));
          } else {
            serverDebug.debug('ensureAdmin: setSession succeeded');
            try {
              const retry = await supabaseAuth.auth.getUser();
              if (retry?.data?.user) {
                const user = retry.data.user as User;
                const role = (user.app_metadata as Record<string, unknown> | undefined)?.role as string | undefined;
                if (!role || !allowedRoles.includes(role)) {
                  serverDebug.warn('ensureAdmin: forbidden after setSession', { user: user.id, role });
                  throw { status: 403, message: 'Không có quyền' };
                }
                return { user, role };
              }
            } catch (e) {
              serverDebug.debug('ensureAdmin: retry getUser() after setSession failed', String(e));
            }
          }
        }
      } catch (e) {
        serverDebug.warn('ensureAdmin: setSession attempt failed', String(e));
      }
    }

    // No valid authenticated session could be established. Do NOT accept sb-session reconstruction here.
    serverDebug.warn('ensureAdmin: unauthenticated (strict)');
    throw { status: 401, message: 'Không xác thực' };
  } catch (e) {
    // Let upstream handlers receive structured errors
    throw e;
  }
}

export default ensureAdmin;
