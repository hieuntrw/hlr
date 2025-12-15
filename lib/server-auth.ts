import type { SupabaseClient } from '@supabase/supabase-js';
import serverDebug from './server-debug';

export async function ensureAdmin(
  supabaseAuth: SupabaseClient,
  allowedRoles: string[] = ['admin', 'mod_finance', 'mod_member']
) {
  const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
  if (userError || !user) {
    serverDebug.warn('ensureAdmin: unauthenticated', userError);
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
