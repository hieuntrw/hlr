/**
 * Helper to set server-side Supabase session (HttpOnly cookies) from the browser.
 * Call this after a client-side sign-in that returns access/refresh tokens.
 */
export async function setServerSession(accessToken: string, refreshToken?: string) {
  if (!accessToken) throw new Error('accessToken required');

  const body: Record<string, string> = { access_token: accessToken };
  if (refreshToken) body.refresh_token = refreshToken;

  const resp = await fetch('/api/auth/set-session', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const json: unknown = await resp.json().catch(() => null);
  if (!resp.ok) {
    const errMsg = json && typeof json === 'object' && 'error' in (json as Record<string, unknown>) ? String((json as Record<string, unknown>)['error']) : 'Failed to set server session';
    throw new Error(errMsg);
  }

  return json as Record<string, unknown> | null;
}

export default setServerSession;
