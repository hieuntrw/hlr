export type Role = 'admin' | 'mod_finance' | 'mod_member' | 'mod_challenge' |'member' | string | null;

export function getEffectiveRole(
  user: { app_metadata?: unknown } | null | undefined,
): Role {
  if (!user) return null;
  const appMeta = user.app_metadata as unknown;
  const roleFromSession = typeof appMeta === 'object' && appMeta !== null && 'role' in (appMeta as Record<string, unknown>)
    ? (appMeta as Record<string, unknown>)['role']
    : undefined;
  if (typeof roleFromSession === 'string') return roleFromSession as Role;
  return null;
}

export function isAdminRole(role: Role): boolean {
  return role === 'admin';
}

export function isModRole(role: Role): boolean {
  return role === 'mod_finance' || role === 'mod_member' || role === 'mod_challenge';
}
