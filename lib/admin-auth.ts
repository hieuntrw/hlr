import { createServerClient } from '@supabase/ssr';
import ensureAdmin from './server-auth';
import serverDebug from './server-debug';

export async function requireAdminFromRequest(getCookie: (name: string) => string | undefined) {
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return getCookie(name);
        },
        set() {},
        remove() {},
      },
    }
  );

  const { user, role } = await ensureAdmin(supabaseAuth, getCookie);
  serverDebug.debug('requireAdminFromRequest: authorized', { user: user?.id ?? null, role });
  return { supabaseAuth, user, role };
}

export default requireAdminFromRequest;
